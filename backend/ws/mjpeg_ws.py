import asyncio
import subprocess
import os
from fastapi import WebSocket, WebSocketDisconnect
from backend.config import load_settings, build_rtsp_url


def _get_ffmpeg():
    import shutil
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def _build_cmd(rtsp_url: str) -> list[str]:
    return [
        _get_ffmpeg(), "-y",
        "-rtsp_transport", "tcp",
        "-timeout", "15000000",
        "-i", rtsp_url,
        "-an",
        "-vf", "scale=640:-2",
        "-c:v", "mjpeg",
        "-q:v", "8",
        "-r", "12",
        "-f", "image2pipe",
        "pipe:1",
    ]


async def mjpeg_websocket(websocket: WebSocket, camera_id: int):
    proc = None
    _err_file = None
    try:
        camera_id = int(camera_id)
        await websocket.accept()

        settings = load_settings()
        cameras = settings.get("cameras", [])
        if camera_id < 0 or camera_id >= len(cameras):
            await websocket.send_bytes(b"")
            await websocket.close()
            return

        cam = cameras[camera_id]
        rtsp_url = build_rtsp_url(cam)

        debug = bool(os.environ.get("MJPEG_DEBUG", ""))
        if debug:
            _err_file = open(f"mjpeg_cam{camera_id}.err", "wb")
            stderr_target = _err_file
        else:
            stderr_target = subprocess.DEVNULL

        loop = asyncio.get_event_loop()
        proc = await loop.run_in_executor(
            None,
            lambda: subprocess.Popen(
                _build_cmd(rtsp_url),
                stdout=subprocess.PIPE,
                stderr=stderr_target,
                stdin=subprocess.DEVNULL,
            )
        )

        buf = b""

        while True:
            chunk = await loop.run_in_executor(None, proc.stdout.read1, 32768)
            if not chunk:
                break
            buf += chunk

            if len(buf) > 153600:
                last_soi = buf.rfind(b"\xff\xd8")
                if last_soi > 0:
                    buf = buf[last_soi:]

            while True:
                soi = buf.find(b"\xff\xd8")
                if soi == -1:
                    buf = b""
                    break
                eoi = buf.find(b"\xff\xd9", soi + 2)
                if eoi == -1:
                    buf = buf[soi:]
                    break
                jpg = buf[soi:eoi + 2]
                buf = buf[eoi + 2:]
                if len(jpg) >= 256:
                    await websocket.send_bytes(jpg)

    except WebSocketDisconnect:
        pass
    except Exception:
        pass
    finally:
        if proc is not None:
            try:
                if proc.poll() is None:
                    proc.kill()
                    proc.wait(timeout=2)
            except Exception:
                try:
                    proc.kill()
                except Exception:
                    pass
            try:
                proc.stdout.close()
            except Exception:
                pass
        if _err_file is not None:
            try:
                _err_file.close()
            except Exception:
                pass