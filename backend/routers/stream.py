from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from backend.config import load_settings, build_mjpeg_rtsp_url, get_camera_by_id
from backend.services.stream_manager import stream_manager
from backend.auth import get_current_user_http

router = APIRouter(prefix="/api/stream", tags=["stream"])


def _check_camera_access(camera_id: str, user: dict):
    cam = get_camera_by_id(camera_id)
    if cam is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    if user["role"] == "traileradv":
        allowed = set(user.get("allowed_camera_ids", []))
        if camera_id not in allowed:
            raise HTTPException(status_code=403, detail="No tienes acceso a esta camara")
    return cam


@router.post("/{camera_id}/start")
def start_stream(camera_id: str, request: Request):
    user = get_current_user_http(request)
    cam = _check_camera_access(camera_id, user)
    url = build_mjpeg_rtsp_url(cam)
    result = stream_manager.start(camera_id, url)
    return result


@router.post("/{camera_id}/stop")
def stop_stream(camera_id: str, request: Request):
    user = get_current_user_http(request)
    _check_camera_access(camera_id, user)
    stream_manager.stop(camera_id)
    return {"success": True}


@router.get("/status")
def stream_status(request: Request):
    get_current_user_http(request)
    return stream_manager.status()


@router.get("/{camera_id}/playlist.m3u8")
def get_playlist(camera_id: str, request: Request):
    user = get_current_user_http(request)
    _check_camera_access(camera_id, user)
    playlist = stream_manager.playlist_path(camera_id)
    if not playlist.exists():
        raise HTTPException(status_code=404, detail="Playlist not found")
    return FileResponse(str(playlist), media_type="application/vnd.apple.mpegurl")
