from fastapi import WebSocket, WebSocketDisconnect
from backend.services.mjpeg_manager import mjpeg_manager
from backend.auth import get_current_user_ws, get_token_from_ws


async def mjpeg_websocket(websocket: WebSocket, camera_id: str):
    token = get_token_from_ws(websocket)
    user = await get_current_user_ws(websocket) if token else None

    if user is None:
        await websocket.close(code=4001, reason="Token requerido")
        return

    if user["role"] == "traileradv":
        allowed = set(user.get("allowed_camera_ids", []))
        if camera_id not in allowed:
            await websocket.close(code=4003, reason="No tienes acceso a esta camara")
            return

    await websocket.accept()
    try:
        await mjpeg_manager.subscribe(camera_id, websocket)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
