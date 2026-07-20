from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.config import load_settings, build_rtsp_url, get_camera_by_id
from backend.services.stream_manager import stream_manager

router = APIRouter(prefix="/api/stream", tags=["stream"])


@router.post("/{camera_id}/start")
def start_stream(camera_id: str):
    cam = get_camera_by_id(camera_id)
    if cam is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    url = build_rtsp_url(cam)
    result = stream_manager.start(camera_id, url)
    return result


@router.post("/{camera_id}/stop")
def stop_stream(camera_id: str):
    stream_manager.stop(camera_id)
    return {"success": True}


@router.get("/status")
def stream_status():
    return stream_manager.status()


@router.get("/{camera_id}/playlist.m3u8")
def get_playlist(camera_id: str):
    playlist = stream_manager.playlist_path(camera_id)
    if not playlist.exists():
        raise HTTPException(status_code=404, detail="Playlist not found")
    return FileResponse(str(playlist), media_type="application/vnd.apple.mpegurl")
