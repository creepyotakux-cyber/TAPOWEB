from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.config import load_settings, build_rtsp_url, get_camera_by_id
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
def take_snapshot(camera_id: str):
    cam = get_camera_by_id(camera_id)
    if cam is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    url = build_rtsp_url(cam)
    return snapshot_service.capture(url, cam.get("name", f"cam{camera_id}"))
