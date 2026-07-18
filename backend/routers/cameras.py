from fastapi import APIRouter, HTTPException
from backend.config import load_settings, save_settings, DEFAULT_CAMERA
from backend.models import CameraCreate, CameraUpdate, ReorderRequest

router = APIRouter(prefix="/api/cameras", tags=["cameras"])


@router.get("")
def list_cameras():
    return load_settings().get("cameras", [])


@router.post("")
def add_camera(cam: CameraCreate):
    settings = load_settings()
    new_cam = {**DEFAULT_CAMERA, **cam.model_dump()}
    if not new_cam["name"]:
        new_cam["name"] = f"Cam{len(settings['cameras']) + 1}"
    settings["cameras"].append(new_cam)
    save_settings(settings)
    return {"success": True, "cameras": settings["cameras"]}


@router.put("/reorder")
def reorder_cameras(req: ReorderRequest):
    settings = load_settings()
    cams = settings.get("cameras", [])
    if req.from_index < 0 or req.from_index >= len(cams):
        raise HTTPException(status_code=400, detail="Invalid from_index")
    to = max(0, min(req.to_index, len(cams) - 1))
    cam = cams.pop(req.from_index)
    cams.insert(to, cam)
    settings["cameras"] = cams
    save_settings(settings)
    return {"success": True, "cameras": cams}


@router.get("/settings")
def get_settings():
    s = load_settings()
    return {"grid_size": s.get("grid_size", 4), "theme": s.get("theme", "dark")}


@router.put("/settings")
def update_settings(body: dict):
    settings = load_settings()
    if "grid_size" in body:
        settings["grid_size"] = max(2, min(6, body["grid_size"]))
    if "theme" in body:
        settings["theme"] = body["theme"]
    save_settings(settings)
    return {"success": True, "grid_size": settings["grid_size"], "theme": settings["theme"]}


@router.put("/{index}")
def update_camera(index: int, cam: CameraUpdate):
    settings = load_settings()
    cameras = settings.get("cameras", [])
    if index < 0 or index >= len(cameras):
        raise HTTPException(status_code=404, detail="Camera not found")
    updates = {k: v for k, v in cam.model_dump().items() if v is not None}
    cameras[index] = {**cameras[index], **updates}
    save_settings(settings)
    return {"success": True, "cameras": cameras}


@router.delete("/{index}")
def remove_camera(index: int):
    settings = load_settings()
    cameras = settings.get("cameras", [])
    if index < 0 or index >= len(cameras):
        raise HTTPException(status_code=404, detail="Camera not found")
    cameras.pop(index)
    settings["cameras"] = cameras
    save_settings(settings)
    return {"success": True, "cameras": cameras}
