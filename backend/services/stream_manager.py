import subprocess
import shutil
from pathlib import Path
from backend.config import HLS_DIR


class StreamManager:
    def __init__(self):
        self._processes: dict[int, subprocess.Popen] = {}

    def _resolve_ffmpeg(self) -> str:
        exe = shutil.which("ffmpeg")
        if exe:
            return exe
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return "ffmpeg"

    def start(self, camera_id: int, rtsp_url: str) -> dict:
        if camera_id in self._processes:
            proc = self._processes[camera_id]
            if proc.poll() is None:
                return {"success": True, "already_running": True, "pid": proc.pid}
            del self._processes[camera_id]

        playlist = HLS_DIR / f"cam_{camera_id}.m3u8"
        segment_pattern = HLS_DIR / f"cam_{camera_id}_%03d.ts"

        ffmpeg = self._resolve_ffmpeg()
        cmd = [
            ffmpeg, "-y",
            "-rtsp_transport", "tcp",
            "-timeout", "15000000",
            "-fflags", "nobuffer",
            "-flags", "low_delay",
            "-probesize", "32000",
            "-analyzeduration", "1000000",
            "-i", rtsp_url,
            "-c:v", "copy",
            "-c:a", "copy",
            "-f", "hls",
            "-hls_time", "1",
            "-hls_list_size", "2",
            "-hls_flags", "delete_segments+append_list+omit_endlist",
            "-hls_segment_filename", str(segment_pattern),
            str(playlist),
        ]

        try:
            proc = subprocess.Popen(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
            )
            self._processes[camera_id] = proc
            return {"success": True, "pid": proc.pid}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def stop(self, camera_id: int) -> bool:
        proc = self._processes.pop(camera_id, None)
        if proc is None:
            return False
        try:
            if proc.poll() is None:
                proc.terminate()
                try:
                    proc.wait(timeout=3)
                except subprocess.TimeoutExpired:
                    proc.kill()
                    proc.wait(timeout=2)
        except Exception:
            pass
        self._cleanup_segments(camera_id)
        return True

    def stop_all(self):
        for cid in list(self._processes.keys()):
            self.stop(cid)

    def status(self) -> list[dict]:
        result = []
        for cid, proc in list(self._processes.items()):
            running = proc.poll() is None
            if not running:
                del self._processes[cid]
            result.append({"camera_id": cid, "active": running, "pid": proc.pid if running else None})
        return result

    def is_active(self, camera_id: int) -> bool:
        proc = self._processes.get(camera_id)
        return proc is not None and proc.poll() is None

    def playlist_path(self, camera_id: int) -> Path:
        return HLS_DIR / f"cam_{camera_id}.m3u8"

    def _cleanup_segments(self, camera_id: int):
        for f in HLS_DIR.glob(f"cam_{camera_id}_*.ts"):
            try:
                f.unlink()
            except OSError:
                pass
        playlist = HLS_DIR / f"cam_{camera_id}.m3u8"
        if playlist.exists():
            try:
                playlist.unlink()
            except OSError:
                pass


stream_manager = StreamManager()
