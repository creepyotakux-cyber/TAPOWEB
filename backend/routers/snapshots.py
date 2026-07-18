from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.config import load_settings, build_rtsp_url
from backend.services.snapshot_service import snapshot_service

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


@router.get("")
def list_snapshots():
    return snapshot_service.list_snapshots()


@router.get("/{filename}")
def download_snapshot(filename: str):
    path = snapshot_service.get_snapshot_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return FileResponse(str(path), media_type="image/jpeg", filename=filename)


@router.post("/{camera_id}")
def take_snapshot(camera_id: int):
    settings = load_settings()
    cameras = settings.get("cameras", [])
    if camera_id < 0 or camera_id >= len(cameras):
        raise HTTPException(status_code=404, detail="Camera not found")
    cam = cameras[camera_id]
    url = build_rtsp_url(cam)
    return snapshot_service.capture(url, cam.get("name", f"cam{camera_id}"))
