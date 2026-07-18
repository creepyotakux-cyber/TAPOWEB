from fastapi import APIRouter, HTTPException
from backend.config import load_settings
from backend.models import PTZCommand
from backend.services.onvif_service import OnvifService

router = APIRouter(prefix="/api/ptz", tags=["ptz"])

_connections: dict[int, OnvifService] = {}


def _get_onvif(camera_id: int) -> OnvifService:
    if camera_id not in _connections:
        _connections[camera_id] = OnvifService()
    return _connections[camera_id]


@router.post("/{camera_id}/connect")
def connect_ptz(camera_id: int):
    settings = load_settings()
    cameras = settings.get("cameras", [])
    if camera_id < 0 or camera_id >= len(cameras):
        raise HTTPException(status_code=404, detail="Camera not found")
    cam = cameras[camera_id]
    onvif = _get_onvif(camera_id)
    result = onvif.connect(cam["ip"], cam["user"], cam["password"])
    return result


@router.post("/{camera_id}/disconnect")
def disconnect_ptz(camera_id: int):
    onvif = _connections.pop(camera_id, None)
    if onvif:
        onvif.disconnect()
    return {"success": True}


@router.get("/{camera_id}/status")
def ptz_status(camera_id: int):
    onvif = _get_onvif(camera_id)
    return {"connected": onvif.is_connected, "led": "on" if onvif._light_on else "off"}


@router.post("/{camera_id}/command")
def ptz_command(camera_id: int, cmd: PTZCommand):
    onvif = _get_onvif(camera_id)
    if not onvif.is_connected:
        raise HTTPException(status_code=400, detail="PTZ not connected")

    match cmd.action:
        case "move":
            onvif.continuous_move(cmd.pan, cmd.tilt)
        case "stop":
            onvif.stop()
        case "goto_preset":
            onvif.goto_preset(cmd.preset_token)
        case "set_preset":
            token = onvif.set_preset(cmd.preset_name)
            return {"success": True, "token": token}
        case "remove_preset":
            onvif.remove_preset(cmd.preset_token)
        case "home":
            onvif.goto_home()
        case "led_on":
            onvif.set_led(True)
        case "led_off":
            onvif.set_led(False)
        case "cruise_h":
            onvif.cruise_horizontal(cmd.speed)
        case "cruise_v":
            onvif.cruise_vertical(cmd.speed)
        case "stop_cruise":
            onvif.stop_cruise()
        case "patrol":
            tokens = cmd.preset_token.split(",") if cmd.preset_token else []
            onvif.start_patrol(tokens, cmd.interval)
        case "stop_patrol":
            onvif.stop_patrol()
        case _:
            raise HTTPException(status_code=400, detail=f"Unknown action: {cmd.action}")

    return {"success": True}


@router.get("/{camera_id}/presets")
def get_presets(camera_id: int):
    onvif = _get_onvif(camera_id)
    if not onvif.is_connected:
        raise HTTPException(status_code=400, detail="PTZ not connected")
    return onvif.get_presets()
