import subprocess
import shutil
import time
import threading
import logging
from pathlib import Path
from backend.config import load_settings, build_rtsp_url, HLS_DIR, RECORDINGS_DIR

logger = logging.getLogger("watchdog")

BLACK_DETECT_SECONDS = 3
BLACK_THRESHOLD = 0.10
CHECK_INTERVAL = 10
STALE_PLAYLIST_SECONDS = 20
MAX_BACKOFF = 300
INITIAL_BACKOFF = 5


def _resolve_ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def _detect_black_screen(rtsp_url: str) -> bool:
    ffmpeg = _resolve_ffmpeg()
    cmd = [
        ffmpeg,
        "-rtsp_transport", "tcp",
        "-timeout", "10000000",
        "-i", rtsp_url,
        "-t", str(BLACK_DETECT_SECONDS),
        "-vf", "signalstats",
        "-f", "null",
        "-",
    ]
    try:
        result = subprocess.run(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.PIPE,
            timeout=BLACK_DETECT_SECONDS + 10,
        )
        stderr = result.stderr.decode("utf-8", errors="replace")
        black_count = 0
        total_count = 0
        for line in stderr.splitlines():
            if "YAVG" in line:
                total_count += 1
                for part in line.split():
                    if part.startswith("YAVG:"):
                        try:
                            yavg = float(part.split(":")[1])
                            if yavg < 16:
                                black_count += 1
                        except (ValueError, IndexError):
                            pass
        if total_count == 0:
            return True
        return (black_count / total_count) > BLACK_THRESHOLD
    except subprocess.TimeoutExpired:
        return True
    except Exception:
        return True


class StreamStatus:
    __slots__ = ("camera_id", "kind", "active", "pid", "healthy", "last_check",
                 "consecutive_failures", "recovering", "black_detected", "last_error")

    def __init__(self, camera_id: str, kind: str):
        self.camera_id = camera_id
        self.kind = kind
        self.active = False
        self.pid: int | None = None
        self.healthy = True
        self.last_check = 0.0
        self.consecutive_failures = 0
        self.recovering = False
        self.black_detected = False
        self.last_error = ""

    def to_dict(self) -> dict:
        return {
            "camera_id": self.camera_id,
            "kind": self.kind,
            "active": self.active,
            "pid": self.pid,
            "healthy": self.healthy,
            "recovering": self.recovering,
            "black_detected": self.black_detected,
            "consecutive_failures": self.consecutive_failures,
            "last_error": self.last_error,
        }


class Watchdog:
    def __init__(self):
        self._statuses: dict[tuple[str, str], StreamStatus] = {}
        self._backoffs: dict[tuple[str, str], float] = {}
        self._stop = threading.Event()
        self._thread: threading.Thread | None = None
        self._hls_manager = None
        self._recording_service = None
        self._lock = threading.Lock()

    def start(self):
        self._stop.clear()
        self._thread = threading.Thread(target=self._loop, daemon=True, name="watchdog")
        self._thread.start()
        logger.info("Watchdog started")

    def stop(self):
        self._stop.set()
        if self._thread:
            self._thread.join(timeout=5)
        logger.info("Watchdog stopped")

    def set_services(self, hls_manager, recording_service):
        self._hls_manager = hls_manager
        self._recording_service = recording_service

    def get_statuses(self) -> list[dict]:
        with self._lock:
            return [s.to_dict() for s in self._statuses.values()]

    def get_status_for(self, camera_id: str) -> list[dict]:
        with self._lock:
            return [s.to_dict() for s in self._statuses.values() if s.camera_id == camera_id]

    def _get_or_create(self, camera_id: str, kind: str) -> StreamStatus:
        key = (camera_id, kind)
        if key not in self._statuses:
            self._statuses[key] = StreamStatus(camera_id, kind)
        return self._statuses[key]

    def _backoff_delay(self, key: tuple[str, str]) -> float:
        delay = self._backoffs.get(key, INITIAL_BACKOFF)
        self._backoffs[key] = min(delay * 2, MAX_BACKOFF)
        return delay

    def _reset_backoff(self, key: tuple[str, str]):
        self._backoffs.pop(key, None)

    def _loop(self):
        while not self._stop.wait(CHECK_INTERVAL):
            try:
                self._check_all()
            except Exception as e:
                logger.error(f"Watchdog check error: {e}")

    def _check_all(self):
        settings = load_settings()
        cameras = settings.get("cameras", [])

        if self._hls_manager:
            self._check_hls(cameras)
        if self._recording_service:
            self._check_recordings(cameras)

    def _check_hls(self, cameras: list[dict]):
        status_list = self._hls_manager.status()
        active_ids = {s["camera_id"] for s in status_list if s.get("active")}
        cam_by_id = {c.get("id"): c for c in cameras}

        for camera_id in active_ids:
            cam = cam_by_id.get(camera_id)
            if cam is None or not cam.get("enabled", True):
                continue

            status = self._get_or_create(camera_id, "hls")
            status.active = True
            proc_info = next((s for s in status_list if s["camera_id"] == camera_id), None)
            status.pid = proc_info.get("pid") if proc_info else None
            status.last_check = time.time()

            alive = proc_info is not None and proc_info.get("active", False)
            playlist = HLS_DIR / f"cam_{camera_id}.m3u8"
            playlist_fresh = False
            if playlist.exists():
                age = time.time() - playlist.stat().st_mtime
                playlist_fresh = age < STALE_PLAYLIST_SECONDS

            if alive and playlist_fresh:
                status.healthy = True
                status.black_detected = False
                status.last_error = ""
                status.recovering = False
                status.consecutive_failures = 0
                self._reset_backoff((camera_id, "hls"))
            else:
                reason = "process dead" if not alive else "playlist stale"
                self._handle_failure(camera_id, "hls", cam, reason, status)

    def _check_recordings(self, cameras: list[dict]):
        for cam in cameras:
            camera_id = cam.get("id", "")
            if not camera_id or not cam.get("enabled", True):
                continue
            if not self._recording_service.is_recording(camera_id):
                continue

            status = self._get_or_create(camera_id, "recording")
            status.active = True
            status.last_check = time.time()

            proc = self._recording_service._processes.get(camera_id)
            alive = proc is not None and proc.poll() is None
            status.pid = proc.pid if alive else None

            if alive:
                status.healthy = True
                status.last_error = ""
                status.recovering = False
                status.consecutive_failures = 0
                self._reset_backoff((camera_id, "recording"))
            else:
                self._handle_failure(camera_id, "recording", cam, "recording process died", status)

    def _handle_failure(self, camera_id: str, kind: str, cam: dict, reason: str, status: StreamStatus):
        status.consecutive_failures += 1
        status.healthy = False
        status.last_error = reason
        logger.warning(f"Camera {camera_id} ({cam.get('name', '?')}) [{kind}] failure #{status.consecutive_failures}: {reason}")

        if status.consecutive_failures == 1:
            rtsp_url = build_rtsp_url(cam)
            status.black_detected = _detect_black_screen(rtsp_url)
            if status.black_detected:
                status.last_error = f"{reason} + black screen detected"

        key = (camera_id, kind)
        delay = self._backoff_delay(key)
        status.recovering = True
        logger.info(f"Camera {camera_id} [{kind}] will retry in {delay:.0f}s (attempt {status.consecutive_failures})")

        t = threading.Thread(
            target=self._retry_after,
            args=(delay, camera_id, kind, cam),
            daemon=True,
            name=f"watchdog-retry-{camera_id}-{kind}",
        )
        t.start()

    def _retry_after(self, delay: float, camera_id: str, kind: str, cam: dict):
        if self._stop.wait(timeout=delay):
            return

        if kind == "hls" and self._hls_manager:
            rtsp_url = build_rtsp_url(cam)
            logger.info(f"Camera {camera_id} [{kind}] restarting HLS stream...")
            result = self._hls_manager.start(camera_id, rtsp_url)
            status = self._get_or_create(camera_id, kind)
            status.last_check = time.time()
            if result.get("success"):
                status.active = True
                status.pid = result.get("pid")
                logger.info(f"Camera {camera_id} [{kind}] restarted successfully (pid={result.get('pid')})")
            else:
                status.last_error = result.get("error", "restart failed")
                logger.error(f"Camera {camera_id} [{kind}] restart failed: {status.last_error}")

        elif kind == "recording" and self._recording_service:
            rtsp_url = build_rtsp_url(cam)
            logger.info(f"Camera {camera_id} [{kind}] restarting recording...")
            result = self._recording_service.start(camera_id, rtsp_url, cam.get("name", f"cam{camera_id}"))
            status = self._get_or_create(camera_id, kind)
            status.last_check = time.time()
            if result.get("success"):
                status.active = True
                logger.info(f"Camera {camera_id} [{kind}] recording restarted")
            else:
                status.last_error = result.get("error", "restart failed")
                logger.error(f"Camera {camera_id} [{kind}] recording restart failed: {status.last_error}")


watchdog = Watchdog()
