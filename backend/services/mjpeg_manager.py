import asyncio
import logging
import shutil
from dataclasses import dataclass, field
from fastapi import WebSocket

from backend.config import load_settings, build_rtsp_url, get_camera_by_id

logger = logging.getLogger("mjpeg_manager")

GRACE_PERIOD = 10.0
QUEUE_MAXSIZE = 2
READ_CHUNK = 32768
BUF_LIMIT = 153600
MIN_FRAME = 256


def _ffmpeg() -> str:
    exe = shutil.which("ffmpeg")
    if exe:
        return exe
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except Exception:
        return "ffmpeg"


def _cmd(rtsp_url: str) -> list[str]:
    return [
        _ffmpeg(), "-y",
        "-rtsp_transport", "tcp",
        "-timeout", "15000000",
        "-fflags", "nobuffer",
        "-flags", "low_delay",
        "-probesize", "32000",
        "-analyzeduration", "500000",
        "-i", rtsp_url,
        "-an",
        "-vf", "scale=640:-2",
        "-c:v", "mjpeg",
        "-q:v", "8",
        "-r", "12",
        "-f", "image2pipe",
        "pipe:1",
    ]


@dataclass
class _CameraStream:
    process: asyncio.subprocess.Process | None = None
    reader_task: asyncio.Task | None = None
    subscribers: dict[WebSocket, asyncio.Queue] = field(default_factory=dict)
    last_frame: bytes | None = None
    grace_task: asyncio.Task | None = None
    lock: asyncio.Lock = field(default_factory=asyncio.Lock)


class MjpegStreamManager:
    def __init__(self):
        self._streams: dict[str, _CameraStream] = {}
        self._global_lock = asyncio.Lock()

    async def subscribe(self, camera_id: str, ws: WebSocket):
        async with self._global_lock:
            stream = self._streams.get(camera_id)
            if stream is None:
                stream = _CameraStream()
                self._streams[camera_id] = stream

            if stream.grace_task:
                stream.grace_task.cancel()
                stream.grace_task = None

            if stream.process is None or stream.process.returncode is not None:
                await self._start_stream(camera_id, stream)

            queue: asyncio.Queue = asyncio.Queue(maxsize=QUEUE_MAXSIZE)
            stream.subscribers[ws] = queue

        if stream.last_frame:
            try:
                await ws.send_bytes(stream.last_frame)
            except Exception:
                await self._unsubscribe(camera_id, ws, stream)
                return

        try:
            while True:
                frame = await queue.get()
                if frame is None:
                    break
                await ws.send_bytes(frame)
        except Exception:
            pass
        finally:
            await self._unsubscribe(camera_id, ws, stream)

    async def _unsubscribe(self, camera_id: str, ws: WebSocket, stream: _CameraStream):
        async with self._global_lock:
            stream.subscribers.pop(ws, None)
            if not stream.subscribers:
                stream.grace_task = asyncio.create_task(self._grace_period(camera_id, stream))

    async def _grace_period(self, camera_id: str, stream: _CameraStream):
        try:
            await asyncio.sleep(GRACE_PERIOD)
            async with self._global_lock:
                if not stream.subscribers:
                    await self._stop_stream(camera_id, stream)
        except asyncio.CancelledError:
            pass

    async def _start_stream(self, camera_id: str, stream: _CameraStream):
        cam = get_camera_by_id(camera_id)
        if cam is None:
            return

        rtsp_url = build_rtsp_url(cam)

        try:
            proc = await asyncio.create_subprocess_exec(
                *_cmd(rtsp_url),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.DEVNULL,
                stdin=asyncio.subprocess.DEVNULL,
            )
            stream.process = proc
            stream.reader_task = asyncio.create_task(self._reader(camera_id, stream, proc))
        except Exception as e:
            logger.error("Failed to start FFmpeg for camera %s: %s", camera_id, e)

    async def _reader(self, camera_id: str, stream: _CameraStream, proc: asyncio.subprocess.Process):
        buf = b""
        try:
            while True:
                chunk = await proc.stdout.read(READ_CHUNK)
                if not chunk:
                    break
                buf += chunk

                if len(buf) > BUF_LIMIT:
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
                    if len(jpg) >= MIN_FRAME:
                        stream.last_frame = jpg
                        for q in list(stream.subscribers.values()):
                            if q.full():
                                try:
                                    q.get_nowait()
                                except asyncio.QueueEmpty:
                                    pass
                            try:
                                q.put_nowait(jpg)
                            except asyncio.QueueFull:
                                pass
        except Exception:
            pass
        finally:
            for q in list(stream.subscribers.values()):
                try:
                    q.put_nowait(None)
                except asyncio.QueueFull:
                    pass

    async def _stop_stream(self, camera_id: str, stream: _CameraStream):
        self._streams.pop(camera_id, None)
        if stream.reader_task:
            stream.reader_task.cancel()
            try:
                await stream.reader_task
            except (asyncio.CancelledError, Exception):
                pass
        if stream.process and stream.process.returncode is None:
            try:
                stream.process.kill()
                await stream.process.wait()
            except Exception:
                pass

    async def shutdown(self):
        async with self._global_lock:
            for cid, stream in list(self._streams.items()):
                await self._stop_stream(cid, stream)

    def status(self) -> list[dict]:
        result = []
        for cid, stream in self._streams.items():
            result.append({
                "camera_id": cid,
                "active": stream.process is not None and stream.process.returncode is None,
                "subscribers": len(stream.subscribers),
                "pid": stream.process.pid if stream.process else None,
            })
        return result


mjpeg_manager = MjpegStreamManager()
