from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from backend.config import load_settings, build_rtsp_url, get_camera_by_id
from backend.services.recording_service import recording_service

router = APIRouter(prefix="/api/recordings", tags=["recordings"])


@router.get("")
def list_recordings():
    return recording_service.list_recordings()


@router.get("/calendar/{camera_id}")
def get_calendar(camera_id: str):
    return recording_service.get_calendar(camera_id)


@router.get("/hours/{camera_id}/{date}")
def get_hours(camera_id: str, date: str):
    if len(date) != 10 or date[4] != "-" or date[7] != "-":
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    return recording_service.get_hours(camera_id, date)


@router.post("/cleanup")
def cleanup_recordings():
    settings = load_settings()
    retention = int(settings.get("recording_retention_days", 7))
    return recording_service.cleanup_old(retention)


@router.post("/{camera_id}/start")
def start_recording(camera_id: str):
    cam = get_camera_by_id(camera_id)
    if cam is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    url = build_rtsp_url(cam)
    return recording_service.start(camera_id, url, cam.get("name", f"cam{camera_id}"))


@router.post("/{camera_id}/stop")
def stop_recording(camera_id: str):
    return recording_service.stop(camera_id)


@router.get("/{camera_id}/status")
def recording_status(camera_id: str):
    return {"recording": recording_service.is_recording(camera_id)}


@router.get("/check/{filename:path}")
def check_recording(filename: str):
    parts = filename.split("/", 1)
    if len(parts) == 2 and parts[0].startswith("cam_"):
        camera_id = parts[0][4:]
    else:
        camera_id = ""
    playable, reason = recording_service.is_segment_playable(camera_id, filename)
    return {"playable": playable, "reason": reason}


@router.get("/stream/{filename:path}")
def stream_recording(filename: str):
    path = recording_service.get_recording_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    return FileResponse(str(path), media_type="video/mp4")


@router.get("/{filename:path}")
def download_recording(filename: str):
    path = recording_service.get_recording_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    return FileResponse(str(path), media_type="video/mp4", filename=Path(filename).name)
