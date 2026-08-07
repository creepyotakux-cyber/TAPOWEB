from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from backend.config import load_settings, build_mjpeg_rtsp_url, get_camera_by_id
from backend.services.snapshot_service import snapshot_service
from backend.auth import get_current_user_http, get_token_from_query_or_header, _authenticate

router = APIRouter(prefix="/api/snapshots", tags=["snapshots"])


def _check_camera_access(camera_id: str, user: dict):
    cam = get_camera_by_id(camera_id)
    if cam is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    if user["role"] == "traileradv":
        allowed = set(user.get("allowed_camera_ids", []))
        if camera_id not in allowed:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta camara")
    return cam


@router.get("")
def list_snapshots(request: Request):
    get_current_user_http(request)
    return snapshot_service.list_snapshots()


@router.get("/{filename}")
def download_snapshot(filename: str, request: Request):
    token = get_token_from_query_or_header(request)
    _authenticate(token)
    path = snapshot_service.get_snapshot_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Snapshot not found")
    return FileResponse(str(path), media_type="image/jpeg", filename=filename)


@router.post("/{camera_id}")
def take_snapshot(camera_id: str, request: Request):
    user = get_current_user_http(request)
    cam = _check_camera_access(camera_id, user)
    url = build_mjpeg_rtsp_url(cam)
    return snapshot_service.capture(url, cam.get("name", f"cam{camera_id}"))
