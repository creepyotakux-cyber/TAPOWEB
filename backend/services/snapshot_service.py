import subprocess
import shutil
import time
from pathlib import Path
from backend.config import SNAPSHOTS_DIR


class SnapshotService:
    def _resolve_ffmpeg(self) -> str:
        exe = shutil.which("ffmpeg")
        if exe:
            return exe
        try:
            import imageio_ffmpeg
            return imageio_ffmpeg.get_ffmpeg_exe()
        except Exception:
            return "ffmpeg"

    def capture(self, rtsp_url: str, camera_name: str = "cam") -> dict:
        name = camera_name.replace(" ", "_")
        ts = time.strftime("%Y%m%d_%H%M%S")
        filename = f"{name}_{ts}.jpg"
        filepath = str(SNAPSHOTS_DIR / filename)

        ffmpeg = self._resolve_ffmpeg()
        cmd = [
            ffmpeg, "-y",
            "-rtsp_transport", "tcp",
            "-i", rtsp_url,
            "-frames:v", "1",
            "-q:v", "2",
            filepath,
        ]

        try:
            result = subprocess.run(
                cmd,
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                timeout=10,
            )
            if result.returncode == 0:
                return {"success": True, "file": filename}
            return {"success": False, "error": "ffmpeg returned non-zero exit code"}
        except subprocess.TimeoutExpired:
            return {"success": False, "error": "timeout capturing snapshot"}
        except Exception as e:
            return {"success": False, "error": str(e)}

    def list_snapshots(self) -> list[dict]:
        snapshots = []
        for f in sorted(SNAPSHOTS_DIR.glob("*.jpg"), reverse=True):
            stat = f.stat()
            snapshots.append({
                "filename": f.name,
                "size": stat.st_size,
                "modified": stat.st_mtime,
            })
        return snapshots

    def get_snapshot_path(self, filename: str) -> Path | None:
        p = SNAPSHOTS_DIR / filename
        if p.exists() and p.parent == SNAPSHOTS_DIR:
            return p
        return None


snapshot_service = SnapshotService()
