import asyncio
from fastapi import WebSocket, WebSocketDisconnect
from backend.config import load_settings
from backend.services.onvif_service import OnvifService

_connections: dict[int, OnvifService] = {}


def _log(msg):
    print(f"[PTZ-WS] {msg}", flush=True)


def _get_onvif(camera_id: int) -> OnvifService:
    if camera_id not in _connections:
        _connections[camera_id] = OnvifService()
    return _connections[camera_id]


async def ptz_websocket(websocket: WebSocket, camera_id: int):
    _log(f"Handler called camera_id={camera_id}")
    try:
        camera_id = int(camera_id)
        await websocket.accept()
        _log("WebSocket accepted")

        settings = load_settings()
        cameras = settings.get("cameras", [])
        if camera_id < 0 or camera_id >= len(cameras):
            _log(f"Camera {camera_id} not found")
            await websocket.send_json({"error": "Camera not found"})
            await websocket.close()
            return

        cam = cameras[camera_id]
        onvif = _get_onvif(camera_id)

        if not onvif.is_connected:
            _log(f"Connecting ONVIF to {cam['ip']}...")
            try:
                loop = asyncio.get_event_loop()
                result = await loop.run_in_executor(
                    None, lambda: onvif.connect(cam["ip"], cam["user"], cam["password"])
                )
            except Exception as e:
                _log(f"ONVIF connect exception: {e}")
                result = {"success": False, "error": str(e)}

            _log(f"ONVIF result: {result.get('success', False)}")

            if not result.get("success"):
                await websocket.send_json({"error": result.get("error", "Connection failed")})
                await websocket.close()
                return

        await websocket.send_json({"connected": True})
        _log("Sent connected=True, entering receive loop")

        while True:
            data = await websocket.receive_json()
            action = data.get("action", "")

            match action:
                case "move":
                    pan = float(data.get("pan", 0))
                    tilt = float(data.get("tilt", 0))
                    ok = onvif.continuous_move(pan, tilt)
                    await websocket.send_json({"ok": ok})
                case "stop":
                    ok = onvif.stop()
                    await websocket.send_json({"ok": ok})
                case "home":
                    ok = onvif.goto_home()
                    await websocket.send_json({"ok": ok})
                case "led_on":
                    ok = onvif.set_led(True)
                    await websocket.send_json({"ok": ok, "led": "on"})
                case "led_off":
                    ok = onvif.set_led(False)
                    await websocket.send_json({"ok": ok, "led": "off"})
                case "goto_preset":
                    ok = onvif.goto_preset(data.get("token", ""))
                    await websocket.send_json({"ok": ok})
                case "set_preset":
                    try:
                        token = onvif.set_preset(data.get("name", ""))
                        await websocket.send_json({"ok": True, "preset_token": token})
                    except Exception:
                        await websocket.send_json({"ok": False})
                case "remove_preset":
                    onvif.remove_preset(data.get("token", ""))
                    await websocket.send_json({"ok": True})
                case "cruise_h":
                    onvif.cruise_horizontal(float(data.get("speed", 0.5)))
                    await websocket.send_json({"ok": True})
                case "cruise_v":
                    onvif.cruise_vertical(float(data.get("speed", 0.5)))
                    await websocket.send_json({"ok": True})
                case "stop_cruise":
                    onvif.stop_cruise()
                    await websocket.send_json({"ok": True})
                case "patrol":
                    tokens = data.get("tokens", [])
                    interval = int(data.get("interval", 10))
                    onvif.start_patrol(tokens, interval)
                    await websocket.send_json({"ok": True})
                case "stop_patrol":
                    onvif.stop_patrol()
                    await websocket.send_json({"ok": True})
                case "presets":
                    loop = asyncio.get_event_loop()
                    presets = await loop.run_in_executor(None, onvif.get_presets)
                    await websocket.send_json({"presets": presets})
    except WebSocketDisconnect:
        _log("Client disconnected")
    except Exception as e:
        _log(f"Exception: {type(e).__name__}: {e}")
        import traceback
        traceback.print_exc()
    finally:
        _log("Handler exiting")
