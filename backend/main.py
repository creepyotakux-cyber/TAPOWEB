from pathlib import Path
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from starlette.routing import WebSocketRoute

from backend.config import HLS_DIR, RECORDINGS_DIR, SNAPSHOTS_DIR
from backend.routers import cameras, stream, ptz, recordings, snapshots
from backend.ws.ptz_ws import ptz_websocket
from backend.ws.mjpeg_ws import mjpeg_websocket
from backend.services.stream_manager import stream_manager
from backend.services.recording_service import recording_service
from backend.services.watchdog import watchdog
from backend.services.mjpeg_manager import mjpeg_manager

FRONTEND_DIR = Path(__file__).parent.parent / "frontend" / "dist"


@asynccontextmanager
async def lifespan(app: FastAPI):
    watchdog.set_services(stream_manager, recording_service)
    watchdog.start()
    yield
    watchdog.stop()
    stream_manager.stop_all()
    await mjpeg_manager.shutdown()


app = FastAPI(title="AGARCORP DE VENEZUELA C.A", version="1.0.0", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(cameras.router)
app.include_router(stream.router)
app.include_router(ptz.router)
app.include_router(recordings.router)
app.include_router(snapshots.router)

app.mount("/hls", StaticFiles(directory=str(HLS_DIR)), name="hls")
app.mount("/recordings/files", StaticFiles(directory=str(RECORDINGS_DIR)), name="recordings_files")
app.mount("/snapshots/files", StaticFiles(directory=str(SNAPSHOTS_DIR)), name="snapshots_files")


async def ws_ptz_handler(websocket):
    camera_id = websocket.path_params["camera_id"]
    await ptz_websocket(websocket, camera_id)


async def ws_mjpeg_handler(websocket):
    camera_id = websocket.path_params["camera_id"]
    await mjpeg_websocket(websocket, camera_id)


app.router.routes.append(WebSocketRoute("/ws/ptz/{camera_id}", ws_ptz_handler))
app.router.routes.append(WebSocketRoute("/ws/mjpeg/{camera_id}", ws_mjpeg_handler))


@app.get("/api/health")
def health():
    return {"status": "ok", "streams": stream_manager.status(), "watchdog": watchdog.get_statuses(), "mjpeg": mjpeg_manager.status()}


if FRONTEND_DIR.exists():
    class SPAIndex:
        def __init__(self, app):
            self.app = app

        async def __call__(self, scope, receive, send):
            if scope["type"] != "http":
                return await self.app(scope, receive, send)
            path = scope["path"]
            if path.startswith("/api/") or path.startswith("/ws/") or path.startswith("/hls/") or path.startswith("/recordings/") or path.startswith("/snapshots/") or path.startswith("/assets/"):
                return await self.app(scope, receive, send)
            from starlette.responses import Response
            index_file = FRONTEND_DIR / "index.html"
            try:
                content = index_file.read_bytes()
            except OSError:
                content = b"<!doctype html><html><body>Frontend not built</body></html>"
            resp = Response(content=content, media_type="text/html")
            return await resp(scope, receive, send)

    app.mount("/assets", StaticFiles(directory=str(FRONTEND_DIR / "assets")), name="static_assets")
    app.add_middleware(SPAIndex)
