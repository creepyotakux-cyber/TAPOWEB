import subprocess
import shutil
import time
import re
import threading
import datetime
import logging
import os
from pathlib import Path
from backend.config import RECORDINGS_DIR, TIMEZONE

logger = logging.getLogger("recording_service")


SEGMENT_PATTERN = re.compile(r"^(\d{4})(\d{2})(\d{2})_(\d{2})\.mp4$")
LEGACY_PATTERN = re.compile(r"^(.+)_(\d{4})(\d{2})(\d{2})_(\d{2})(\d{2})(\d{2})\.mp4$")


class RecordingService:
    def __init__(self):
        self._processes: dict[str, subprocess.Popen] = {}
        self._paths: dict[str, str] = {}
        self._names: dict[str, str] = {}
        self._cleanup_stop: threading.Event | None = None
        self._cleanup_thread: threading.Thread | None = None

    def kill_orphans(self) -> int:
        """Kill all ffmpeg processes that are writing DVR segments.
        Called on startup to clean up processes from a previous run."""
        killed = 0
        try:
            import psutil
            for proc in psutil.process_iter(['pid', 'name', 'cmdline']):
                try:
                    cmdline = proc.info.get('cmdline') or []
                    if len(cmdline) < 3:
                        continue
                    # Detect: ffmpeg ... -f segment ... %Y%m%d_%H.mp4
                    if '-f' in cmdline and 'segment' in cmdline and any(
                        '%Y%m%d_%H.mp4' in arg for arg in cmdline
                    ):
                        proc.kill()
                        killed += 1
                        logger.info("Killed orphan ffmpeg PID %s", proc.info['pid'])
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    pass
        except ImportError:
            pass
        return killed

    def _resolve_ffmpeg(self) -> str:
        exe = shutil.which("ffmpeg")
        if exe:
            return exe
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return "ffmpeg"

    def _resolve_ffprobe(self) -> str | None:
        exe = shutil.which("ffprobe")
        if exe:
            return exe
        # Try alongside ffmpeg
        ffmpeg = shutil.which("ffmpeg")
        if ffmpeg:
            candidate = Path(ffmpeg).parent / "ffprobe.exe"
            if candidate.exists():
                return str(candidate)
            candidate = Path(ffmpeg).parent / "ffprobe"
            if candidate.exists():
                return str(candidate)
        return None

    def _camera_dir(self, camera_id: str) -> Path:
        return RECORDINGS_DIR / f"cam_{camera_id}"

    def _ensure_dir(self, camera_id: str) -> Path:
        d = self._camera_dir(camera_id)
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _delete_stale_current_segment(self, camera_id: str) -> None:
        """Remove the file for the current local hour if it is 0 bytes or was
        last modified >60 s ago (likely a stuck/partial segment from a prior
        ffmpeg that died without flushing its moov atom). FFmpeg's segment
        muxer refuses to overwrite a partially-written file cleanly on
        Windows, so we delete it so the next ffmpeg starts fresh."""
        try:
            d = self._camera_dir(camera_id)
            if not d.exists():
                return
            name = datetime.datetime.now(TIMEZONE).strftime("%Y%m%d_%H.mp4")
            f = d / name
            if not f.exists():
                return
            try:
                stat = f.stat()
            except OSError:
                return
            if stat.st_size == 0:
                logger.info("Camera %s: removing empty current segment %s", camera_id, name)
                f.unlink(missing_ok=True)
                return
            age = time.time() - stat.st_mtime
            if age > 60:
                logger.warning(
                    "Camera %s: removing stale current segment %s (size=%d, age=%ds)",
                    camera_id, name, stat.st_size, int(age),
                )
                f.unlink(missing_ok=True)
        except OSError:
            pass

    def _cleanup_broken_segments(self, camera_id: str) -> int:
        """Remove MP4 files from previous hours that lack a valid moov atom.
        These are orphaned by unclean ffmpeg shutdowns and cannot be played."""
        d = self._camera_dir(camera_id)
        if not d.exists():
            return 0
        current_name = datetime.datetime.now(TIMEZONE).strftime("%Y%m%d_%H.mp4")
        deleted = 0
        for f in list(d.glob("*.mp4")):
            if not SEGMENT_PATTERN.match(f.name):
                continue
            if f.name == current_name:
                continue
            try:
                if f.stat().st_size < self.MIN_PLAYABLE_SIZE:
                    f.unlink(missing_ok=True)
                    deleted += 1
                    continue
                if not self._has_valid_moov(f):
                    logger.warning("Camera %s: removing broken segment %s (no moov atom)", camera_id, f.name)
                    f.unlink(missing_ok=True)
                    deleted += 1
            except OSError:
                pass
        if deleted:
            logger.info("Camera %s: cleaned up %d broken segment(s)", camera_id, deleted)
        return deleted

    def start(self, camera_id: str, rtsp_url: str, camera_name: str = "cam") -> dict:
        if camera_id in self._processes:
            proc = self._processes[camera_id]
            if proc.poll() is None:
                return {"success": True, "already_running": True, "message": "DVR recording already active"}

        self._names[camera_id] = camera_name
        self._cleanup_broken_segments(camera_id)
        self._delete_stale_current_segment(camera_id)
        out_dir = self._ensure_dir(camera_id)

        ffmpeg = self._resolve_ffmpeg()
        seg_path = str(out_dir / "%Y%m%d_%H.mp4")

        creation = datetime.datetime.now(TIMEZONE).strftime("%Y-%m-%dT%H:%M:%S-04:00")

        cmd = [
            ffmpeg, "-y",
            "-rtsp_transport", "tcp",
            "-timeout", "15000000",
            "-fflags", "+genpts",
            "-i", rtsp_url,
            "-c:v", "copy",
            "-c:a", "aac",
            "-f", "segment",
            "-segment_time", "3600",
            "-segment_format", "mp4",
            "-strftime", "1",
            "-reset_timestamps", "1",
            "-segment_atclocktime", "1",
            "-segment_start_number", "0",
            "-segment_format_options", "movflags=+frag_keyframe+empty_moov+default_base_moof",
            "-metadata", f"creation_time={creation}",
            seg_path,
        ]

        try:
            proc = subprocess.Popen(
                cmd,
                stdin=subprocess.PIPE,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.PIPE,
                env={**os.environ, "TZ": "America/Caracas"},
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
            )
            t = threading.Thread(
                target=self._stderr_reader,
                args=(camera_id, proc),
                daemon=True,
                name=f"dvr-stderr-{camera_id}",
            )
            t.start()
            self._processes[camera_id] = proc
            self._paths[camera_id] = seg_path
            self._start_cleanup_loop()
            return {"success": True, "mode": "dvr", "directory": f"cam_{camera_id}", "segment_time": 3600}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def _stderr_reader(self, camera_id: str, proc: subprocess.Popen):
        try:
            for raw in iter(proc.stderr.readline, b""):
                line = raw.decode("utf-8", "replace").rstrip()
                if not line:
                    continue
                low = line.lower()
                if any(k in low for k in ("error", "denied", "401", "403", "refused", "timed out", "unauthorized", "not permitted")):
                    logger.warning("Camera %s DVR: %s", camera_id, line)
        except Exception:
            pass

    def _in_progress_filename(self, camera_id: str) -> str | None:
        """Return the filename of the segment currently being written by FFmpeg,
        or None if the camera is not recording right now. The DVR writes
        ``%Y%m%d_%H.mp4`` in the camera directory; the file at this exact
        local hour is the one FFmpeg still holds open (moov atom not flushed
        yet, so browsers cannot stream it)."""
        proc = self._processes.get(camera_id)
        if proc is None or proc.poll() is not None:
            return None
        return datetime.datetime.now(TIMEZONE).strftime("%Y%m%d_%H.mp4")

    def _iter_segment_files(self, camera_id: str, skip_in_progress: bool = False):
        d = self._camera_dir(camera_id)
        if not d.exists():
            return []
        skip_name = self._in_progress_filename(camera_id) if skip_in_progress else None
        out = []
        for f in d.glob("*.mp4"):
            if not SEGMENT_PATTERN.match(f.name):
                continue
            if skip_name and f.name == skip_name:
                continue
            out.append(f)
        return out

    def stop(self, camera_id: str) -> dict:
        proc = self._processes.pop(camera_id, None)
        path = self._paths.pop(camera_id, None)
        self._names.pop(camera_id, None)
        if proc is None:
            return {"success": False, "error": "not recording"}
        try:
            if proc.stdin:
                try:
                    proc.stdin.write(b"q")
                    proc.stdin.flush()
                except Exception:
                    pass
            try:
                proc.wait(timeout=5)
            except subprocess.TimeoutExpired:
                try:
                    proc.terminate()
                except Exception:
                    pass
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=2)
        except Exception:
            pass
        return {"success": True, "file": path}

    def stop_all(self):
        for cid in list(self._processes.keys()):
            try:
                self.stop(cid)
            except Exception:
                pass
        if self._cleanup_thread is not None and self._cleanup_stop is not None:
            self._cleanup_stop.set()

    def is_recording(self, camera_id: str) -> bool:
        proc = self._processes.get(camera_id)
        return proc is not None and proc.poll() is None

    def list_recordings(self) -> list[dict]:
        recordings: list[dict] = []

        for cam_dir in RECORDINGS_DIR.glob("cam_*"):
            if not cam_dir.is_dir():
                continue
            cam_id = cam_dir.name.removeprefix("cam_")
            for f in self._iter_segment_files(cam_id, skip_in_progress=True):
                m = SEGMENT_PATTERN.match(f.name)
                if not m:
                    continue
                stat = f.stat()
                date_str = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
                hour = int(m.group(4))
                recordings.append({
                    "filename": f"{cam_dir.name}/{f.name}",
                    "size": stat.st_size,
                    "modified": stat.st_mtime,
                    "camera_id": cam_id,
                    "date": date_str,
                    "hour": hour,
                    "type": "dvr",
                })

        for f in RECORDINGS_DIR.glob("*.mp4"):
            if f.parent != RECORDINGS_DIR:
                continue
            stat = f.stat()
            recordings.append({
                "filename": f.name,
                "size": stat.st_size,
                "modified": stat.st_mtime,
                "camera_id": None,
                "date": None,
                "hour": None,
                "type": "manual",
            })

        recordings.sort(key=lambda r: r["modified"], reverse=True)
        return recordings

    def get_calendar(self, camera_id: str) -> list[dict]:
        by_date: dict[str, dict] = {}
        for f in self._iter_segment_files(camera_id, skip_in_progress=False):
            m = SEGMENT_PATTERN.match(f.name)
            if not m:
                continue
            date_str = f"{m.group(1)}-{m.group(2)}-{m.group(3)}"
            entry = by_date.setdefault(date_str, {"date": date_str, "count": 0, "total_size": 0, "hours": []})
            entry["count"] += 1
            entry["total_size"] += f.stat().st_size
            entry["hours"].append(int(m.group(4)))
        result = sorted(by_date.values(), key=lambda x: x["date"], reverse=True)
        for e in result:
            e["hours"].sort()
        return result

    MIN_PLAYABLE_SIZE = 10240  # 10 KB — segments smaller than this are incomplete

    def _has_valid_moov(self, filepath: Path) -> bool:
        """Use ffprobe to verify the MP4 has a valid moov atom."""
        ffprobe = self._resolve_ffprobe()
        if not ffprobe:
            # Can't verify — trust size check only
            return True
        try:
            result = subprocess.run(
                [ffprobe, "-v", "error", "-show_entries",
                 "stream=codec_type", "-of", "csv=p=0", str(filepath)],
                capture_output=True, timeout=5,
                creationflags=subprocess.CREATE_NO_WINDOW if hasattr(subprocess, "CREATE_NO_WINDOW") else 0,
            )
            # If ffprobe finds streams, the file is valid
            output = result.stdout.decode("utf-8", "replace").strip()
            return len(output) > 0
        except Exception:
            return True  # Can't verify — trust size check

    def is_segment_playable(self, camera_id: str, filename: str) -> tuple[bool, str]:
        """Check whether a DVR segment file is safe to play.
        Returns (playable, reason)."""
        p = (RECORDINGS_DIR / filename).resolve()
        try:
            p.relative_to(RECORDINGS_DIR.resolve())
        except ValueError:
            return False, "invalid path"
        if not p.exists() or not p.is_file():
            return False, "file not found"
        try:
            size = p.stat().st_size
        except OSError:
            return False, "stat failed"
        if size < self.MIN_PLAYABLE_SIZE:
            return False, "file too small (still recording)"
        is_in_progress = False
        skip_name = self._in_progress_filename(camera_id)
        if skip_name and p.name == skip_name:
            is_in_progress = True
        if not self._has_valid_moov(p):
            if is_in_progress:
                return False, "segment in progress (moov not ready)"
            return False, "invalid mp4 (moov atom missing)"
        if is_in_progress:
            return True, "in progress"
        return True, "ok"

    def get_hours(self, camera_id: str, date_str: str) -> list[dict]:
        ymd = date_str.replace("-", "")
        cam_dir = self._camera_dir(camera_id)
        if not cam_dir.exists():
            return []
        skip_name = self._in_progress_filename(camera_id)
        hours: list[dict] = []
        for f in cam_dir.glob(f"{ymd}_*.mp4"):
            m = SEGMENT_PATTERN.match(f.name)
            if not m:
                continue
            is_in_progress = bool(skip_name and f.name == skip_name)
            hour = int(m.group(4))
            stat = f.stat()
            playable = stat.st_size >= self.MIN_PLAYABLE_SIZE and self._has_valid_moov(f)
            hours.append({
                "hour": hour,
                "filename": f"cam_{camera_id}/{f.name}",
                "size": stat.st_size,
                "modified": stat.st_mtime,
                "playable": playable,
                "in_progress": is_in_progress,
            })
        hours.sort(key=lambda x: x["hour"])
        return hours

    def cleanup_old(self, retention_days: int) -> dict:
        if retention_days <= 0:
            return {"success": True, "deleted": 0, "message": "retention disabled"}
        cutoff = time.time() - retention_days * 86400
        deleted = 0
        freed = 0
        for cam_dir in RECORDINGS_DIR.glob("cam_*"):
            if not cam_dir.is_dir():
                continue
            for f in cam_dir.glob("*.mp4"):
                if not SEGMENT_PATTERN.match(f.name):
                    continue
                try:
                    stat = f.stat()
                except OSError:
                    continue
                if stat.st_mtime < cutoff:
                    try:
                        f.unlink()
                        deleted += 1
                        freed += stat.st_size
                    except OSError:
                        pass
        return {"success": True, "deleted": deleted, "freed_bytes": freed}

    def _start_cleanup_loop(self):
        if self._cleanup_thread is not None and self._cleanup_thread.is_alive():
            return
        self._cleanup_stop = threading.Event()
        self._cleanup_thread = threading.Thread(target=self._cleanup_loop, daemon=True)
        self._cleanup_thread.start()

    def _cleanup_loop(self):
        from backend.config import load_settings
        stop = self._cleanup_stop
        if stop is None:
            return
        while not stop.wait(3600):
            try:
                settings = load_settings()
                retention = int(settings.get("recording_retention_days", 7))
                if retention > 0:
                    self.cleanup_old(retention)
            except Exception:
                pass

    PREPARE_DIR_NAME = "_prepare"

    def _prepare_dir(self) -> Path:
        d = RECORDINGS_DIR / self.PREPARE_DIR_NAME
        d.mkdir(parents=True, exist_ok=True)
        return d

    def _cleanup_prepare_dir(self):
        d = RECORDINGS_DIR / self.PREPARE_DIR_NAME
        if not d.exists():
            return
        cutoff = time.time() - 600
        for f in d.glob("*"):
            try:
                if f.stat().st_mtime < cutoff:
                    f.unlink(missing_ok=True)
            except OSError:
                pass

    def prepare_segment(self, filename: str) -> tuple[Path | None, str]:
        p = (RECORDINGS_DIR / filename).resolve()
        try:
            p.relative_to(RECORDINGS_DIR.resolve())
        except ValueError:
            return None, "invalid path"
        if not p.exists() or not p.is_file():
            return None, "file not found"
        try:
            size = p.stat().st_size
        except OSError:
            return None, "stat failed"
        if size < self.MIN_PLAYABLE_SIZE:
            return None, "file too small"
        if self._has_valid_moov(p):
            return p, "already_ready"
        return None, "moov not ready"

    def get_recording_path(self, filename: str) -> Path | None:
        p = (RECORDINGS_DIR / filename).resolve()
        try:
            p.relative_to(RECORDINGS_DIR.resolve())
        except ValueError:
            return None
        if p.exists() and p.is_file():
            return p
        return None


recording_service = RecordingService()
