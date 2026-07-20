from fastapi import WebSocket, WebSocketDisconnect
from backend.services.mjpeg_manager import mjpeg_manager


async def mjpeg_websocket(websocket: WebSocket, camera_id: str):
    await websocket.accept()
    try:
        await mjpeg_manager.subscribe(camera_id, websocket)
    except WebSocketDisconnect:
        pass
    except Exception:
        pass
