from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.config import load_settings, build_rtsp_url
from backend.services.stream_manager import stream_manager

router = APIRouter(prefix="/api/stream", tags=["stream"])


@router.post("/{camera_id}/start")
def start_stream(camera_id: int):
    settings = load_settings()
    cameras = settings.get("cameras", [])
    if camera_id < 0 or camera_id >= len(cameras):
        raise HTTPException(status_code=404, detail="Camera not found")
    cam = cameras[camera_id]
    url = build_rtsp_url(cam)
    result = stream_manager.start(camera_id, url)
    return result


@router.post("/{camera_id}/stop")
def stop_stream(camera_id: int):
    stream_manager.stop(camera_id)
    return {"success": True}


@router.get("/status")
def stream_status():
    return stream_manager.status()


@router.get("/{camera_id}/playlist.m3u8")
def get_playlist(camera_id: int):
    playlist = stream_manager.playlist_path(camera_id)
    if not playlist.exists():
        raise HTTPException(status_code=404, detail="Playlist not found")
    return FileResponse(str(playlist), media_type="application/vnd.apple.mpegurl")
