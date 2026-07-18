import json
from pathlib import Path

BASE_DIR = Path(__file__).parent
DATA_DIR = BASE_DIR / "data"
HLS_DIR = DATA_DIR / "hls"
RECORDINGS_DIR = DATA_DIR / "recordings"
SNAPSHOTS_DIR = DATA_DIR / "snapshots"
CONFIG_PATH = DATA_DIR / "cameras.json"

for d in (DATA_DIR, HLS_DIR, RECORDINGS_DIR, SNAPSHOTS_DIR):
    d.mkdir(parents=True, exist_ok=True)

DEFAULT_SETTINGS: dict = {
    "cameras": [],
    "grid_size": 4,
    "theme": "dark",
    "recording_retention_days": 7,
}

DEFAULT_CAMERA: dict = {
    "name": "",
    "ip": "",
    "user": "",
    "password": "",
    "cloud_password": "",
    "enabled": True,
    "model": "",
}


def build_rtsp_url(cam: dict) -> str:
    stream_path = cam.get("stream_path") or "stream1"
    return f"rtsp://{cam['user']}:{cam['password']}@{cam['ip']}:554/{stream_path}"


def load_settings() -> dict:
    if CONFIG_PATH.exists():
        try:
            with open(CONFIG_PATH, "r", encoding="utf-8") as f:
                data = json.load(f)
            return {**DEFAULT_SETTINGS, **data}
        except (json.JSONDecodeError, OSError):
            pass
    return dict(DEFAULT_SETTINGS)


def save_settings(settings: dict) -> None:
    with open(CONFIG_PATH, "w", encoding="utf-8") as f:
        json.dump(settings, f, indent=2, ensure_ascii=False)


def get_camera(index: int) -> dict | None:
    cams = load_settings().get("cameras", [])
    if 0 <= index < len(cams):
        return cams[index]
    return None
