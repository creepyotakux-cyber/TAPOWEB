import json
import logging
from pathlib import Path
from uuid import uuid4
from zoneinfo import ZoneInfo

TIMEZONE = ZoneInfo("America/Caracas")

logger = logging.getLogger("config")

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
HLS_DIR = DATA_DIR / "hls"
RECORDINGS_DIR = Path.home() / "Documents" / "TAPO" / "RECORDS"
SNAPSHOTS_DIR = DATA_DIR / "snapshots"
CONFIG_PATH = DATA_DIR / "cameras.json"

for d in (DATA_DIR, HLS_DIR, RECORDINGS_DIR, SNAPSHOTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

DEFAULT_SETTINGS: dict = {
    "cameras": [],
    "grid_size": 4,
    "theme": "dark",
    "view_mode": "grid",
    "main_camera": "",
    "recording_retention_days": 7,
}

DEFAULT_CAMERA: dict = {
    "id": "",
    "name": "",
    "ip": "",
    "user": "",
    "password": "",
    "cloud_password": "",
    "enabled": True,
    "model": "",
}


def generate_id() -> str:
    return uuid4().hex[:8]


def build_rtsp_url(cam: dict) -> str:
    """RTSP URL for the MAIN stream (used by DVR/recording and snapshots)."""
    stream_path = cam.get("stream_path") or "stream1"
    return f"rtsp://{cam['user']}:{cam['password']}@{cam['ip']}:554/{stream_path}"


def build_mjpeg_rtsp_url(cam: dict) -> str:
    """RTSP URL for the SUB stream (used by the MJPEG grid).

    Tapo C500 only allows 1 concurrent session per stream. Using stream2
    (sub) for the MJPEG grid lets it run alongside the DVR (which uses
    stream1/main) without 'Operation not permitted' on the second pull.
    Override per-camera via the ``mjpeg_stream_path`` field.
    """
    stream_path = cam.get("mjpeg_stream_path") or "stream2"
    return f"rtsp://{cam['user']}:{cam['password']}@{cam['ip']}:554/{stream_path}"


def _sanitize_cameras(cameras: list[dict]) -> tuple[list[dict], bool]:
    """Ensure every camera has a unique non-empty id and a unique non-empty ip.

    Returns (clean_list, changed). Drops any entry without an ip, and keeps
    only the first occurrence per ip (and per id). Missing ids are generated.
    Mutations to the persisted file happen only when ``changed`` is True.
    """
    changed = False
    seen_ip: set[str] = set()
    seen_id: set[str] = set()
    cleaned: list[dict] = []
    for cam in cameras:
        if not isinstance(cam, dict):
            changed = True
            continue
        ip = (cam.get("ip") or "").strip()
        cid = (cam.get("id") or "").strip()
        if not ip:
            logger.warning("Camera without ip dropped during sanitize: %r", cam.get("name"))
            changed = True
            continue
        if ip in seen_ip:
            logger.warning("Duplicate camera ip %s dropped during sanitize (kept first)", ip)
            changed = True
            continue
        if cid and cid in seen_id:
            logger.warning("Duplicate camera id %s reassigned during sanitize", cid)
            cid = ""
            changed = True
        if not cid:
            cid = generate_id()
            changed = True
        seen_ip.add(ip)
        seen_id.add(cid)
        clean = {**DEFAULT_CAMERA, **cam, "id": cid, "ip": ip}
        cleaned.append(clean)
    return cleaned, changed


def load_settings() -> dict:
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            settings = {**DEFAULT_SETTINGS, **data}
            cameras, changed = _sanitize_cameras(settings.get("cameras", []))
            settings["cameras"] = cameras
            if changed:
                save_settings(settings)
            return settings
        except (json.JSONDecodeError, OSError):
            pass
    return dict(DEFAULT_SETTINGS)


def save_settings(settings: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)


def get_camera_by_id(camera_id: str) -> dict | None:
    cams = load_settings().get("cameras", [])
    for cam in cams:
        if cam.get("id") == camera_id:
            return cam
    return None
