from pathlib import Path

from fastapi import APIRouter, HTTPException, Request
from fastapi.responses import FileResponse
from backend.config import load_settings, build_rtsp_url, get_camera_by_id, RECORDINGS_DIR
from backend.services.recording_service import recording_service
from backend.auth import get_current_user_http, get_token_from_query_or_header, _authenticate

router = APIRouter(prefix="/api/recordings", tags=["recordings"])


def _check_baseadv(request: Request):
    user = get_current_user_http(request)
    if user["role"] != "baseadv":
        raise HTTPException(status_code=403, detail="Solo el administrador puede acceder a las grabaciones")
    return user


def _auth_query_or_header(request: Request):
    token = get_token_from_query_or_header(request)
    user = _authenticate(token)
    if user["role"] != "baseadv":
        raise HTTPException(status_code=403, detail="Solo el administrador puede acceder a las grabaciones")
    return user


@router.get("")
def list_recordings(request: Request):
    _check_baseadv(request)
    return recording_service.list_recordings()


@router.get("/calendar/{camera_id}")
def get_calendar(camera_id: str, request: Request):
    _check_baseadv(request)
    return recording_service.get_calendar(camera_id)


@router.get("/hours/{camera_id}/{date}")
def get_hours(camera_id: str, date: str, request: Request):
    _check_baseadv(request)
    if len(date) != 10 or date[4] != "-" or date[7] != "-":
        raise HTTPException(status_code=400, detail="date must be YYYY-MM-DD")
    return recording_service.get_hours(camera_id, date)


@router.post("/cleanup")
def cleanup_recordings(request: Request):
    _check_baseadv(request)
    settings = load_settings()
    retention = int(settings.get("recording_retention_days", 7))
    return recording_service.cleanup_old(retention)


@router.post("/{camera_id}/start")
def start_recording(camera_id: str, request: Request):
    _check_baseadv(request)
    cam = get_camera_by_id(camera_id)
    if cam is None:
        raise HTTPException(status_code=404, detail="Camera not found")
    url = build_rtsp_url(cam)
    return recording_service.start(camera_id, url, cam.get("name", f"cam{camera_id}"))


@router.post("/{camera_id}/stop")
def stop_recording(camera_id: str, request: Request):
    _check_baseadv(request)
    return recording_service.stop(camera_id)


@router.get("/{camera_id}/status")
def recording_status(camera_id: str, request: Request):
    _check_baseadv(request)
    return {"recording": recording_service.is_recording(camera_id)}


@router.get("/check/{filename:path}")
def check_recording(filename: str, request: Request):
    _check_baseadv(request)
    parts = filename.split("/", 1)
    if len(parts) == 2 and parts[0].startswith("cam_"):
        camera_id = parts[0][4:]
    else:
        camera_id = ""
    playable, reason = recording_service.is_segment_playable(camera_id, filename)
    return {"playable": playable, "reason": reason}


@router.get("/stream/{filename:path}")
def stream_recording(filename: str, request: Request):
    _auth_query_or_header(request)
    path = recording_service.get_recording_path(filename)
    if path is None:
        path = recording_service.get_recording_path(f"_prepare/{filename.replace('/', '_').replace('\\', '_')}")
    if path is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    return FileResponse(str(path), media_type="video/mp4")


@router.post("/prepare/{filename:path}")
def prepare_recording(filename: str, request: Request):
    _check_baseadv(request)
    path, reason = recording_service.prepare_segment(filename)
    if path is None:
        raise HTTPException(status_code=400, detail=reason)
    prepared_filename = str(path.relative_to(RECORDINGS_DIR)).replace("\\", "/")
    return {"ready": True, "prepared_filename": prepared_filename}


@router.get("/{filename:path}")
def download_recording(filename: str, request: Request):
    _auth_query_or_header(request)
    path = recording_service.get_recording_path(filename)
    if path is None:
        raise HTTPException(status_code=404, detail="Recording not found")
    return FileResponse(str(path), media_type="video/mp4", filename=Path(filename).name)
