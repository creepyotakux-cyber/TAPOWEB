# AGENTS.md — WebTapo

Registro de cómo debe estar el sistema para funcionar correctamente.
Guía de referencia para cualquier agente (humano o IA) que toque este repo.

##Árbol del proyecto

```
WebTapo/
├── backend/                  FastAPI (Python) — API + WS + FFmpeg
│   ├── __main__.py           python -m backend  → uvicorn :8000
│   ├── main.py               app FastAPI, rutas, lifespan, SPA mount
│   ├── config.py             cameras.json, build_rtsp_url, *_DIR, sanitize
│   ├── models.py             Pydantic (CameraCreate/Update, PTZCommand...)
│   ├── data/
│   │   ├── cameras.json      CONFIGURACIÓN DE CÁMARAS (editar con cuidado)
│   │   ├── hls/              playlists HLS por cámara
│   │   └── snapshots/        JPG puntuales
│   └── recordings → ~/Documents/TAPO/RECORDS   DVR continuo segmentado por hora (se crea solo)
│   ├── routers/
│   │   ├── cameras.py        CRUD + settings (valida IP única → 409)
│   │   ├── stream.py         HLS start/stop/playlist
│   │   ├── ptz.py            ONVIF PTZ REST
│   │   ├── recordings.py     DVR (start/stop/calendar/hours/cleanup)
│   │   └── snapshots.py      captura puntual
│   ├── services/
│   │   ├── onvif_service.py  cliente ONVIF (puerto 2020, PTZ/presets/cruise)
│   │   ├── mjpeg_manager.py   MJPEG por WS (asyncio.subprocess + pipe)
│   │   ├── stream_manager.py  HLS (subprocess.Popen + archivos .ts/.m3u8)
│   │   ├── recording_service.py DVR segmentado horario
│   │   ├── snapshot_service.py 1 frame
│   │   └── watchdog.py       monitor HLS+recording, restart con backoff
│   └── ws/
│       ├── mjpeg_ws.py       /ws/mjpeg/{camera_id}
│       └── ptz_ws.py        /ws/ptz/{camera_id}
└── frontend/                 React 19 + Vite + TS + Tailwind v4 + dnd-kit
    └── src/
        ├── App.tsx           layout + theme
        ├── lib/api.ts        cliente API + tipos (Camera, WatchdogStatus...)
        ├── pages/            Dashboard / Config / Dvr / Recordings
        ├── components/       CameraTile / PTZPanel / Sidebar
        └── hooks/            useMjpegWs / usePtzWs / useKeyboardPtz
```

## Cómo se identifica una cámara

**CLAVE FUNDAMENTAL:** cada cámara se identifica por su `id` (string, 8 hex chars generados por `backend.config.generate_id`). Todas las APIs, WebSockets y servicios usan `camera_id: str` = ese `id`.

- **NO se usan índices enteros en ningún lado.** Si ves código que hace `cameras[camera_id]` o `camera_id < len(cameras)`, está roto y hay que migrarlo a `get_camera_by_id(camera_id)`.
- El `ip` es la **identidad física** de la cámara y debe ser **único** en `cameras.json`.
- El `user`/`password` son las credenciales 3rd-party account de la cámara Tapo (mismo user/pass para ONVIF puerto 2020 y para RTSP puerto 554 — si RTSP da 401 pero ONVIF funciona, el RTSP está deshabilitado o desincronizado en esa cámara, ver abajo).

## Modelo de `cameras.json`

```json
{
  "cameras": [
    {
      "id": "b722100b",          // obligatorio, único, 8 hex
      "name": "mpfm40401",       // display
      "ip": "192.168.239.51",    // obligatorio, único
      "user": "mpfm40401",       // usuario 3rd-party Tapo
      "password": "agar1212",
      "cloud_password": "",      // reservado
      "enabled": true,
      "model": "c500"            // c200 / c500 / ""
    }
  ],
  "grid_size": 4,
  "theme": "dark",
  "view_mode": "grid",          // "grid" | "lmain"
  "main_camera": "b722100b",    // id usado en vista L+MAIN
  "recording_retention_days": 7
}
```

### Invariantes (versan backend al cargar)

`backend.config._sanitize_cameras` se ejecuta dentro de `load_settings()` y:

1. Dropea cualquier cámara sin `ip`.
2. Dropea duplicados por `ip` (se queda la primera ocurrencia).
3. Dropea/reasigna duplicados por `id`.
4. Genera `id` para las entradas que no tengan.
5. Si hubo cambios, **persiste** `cameras.json` saneado.

Si editas `cameras.json` a mano, asegúrate de: ip única, id único y no vacío. Sino el sanitizer lo arreglará solo al arrancar el backend (y logueará warnings).

### Validación en runtime

`backend.routers.cameras.add_camera` y `update_camera` responden **409** con
`detail = "Ya existe una camara con la IP <ip>"` si otra cámara ya usa esa IP.
El frontend `Config.tsx` muestra el mensaje en un `alert()`.

## Cómo arrancar

**Backend** (en una terminal aparte, NO dejar corriendo dentro del agente):

```powershell
pip install -r backend/requirements.txt
python -m backend          # uvicorn 0.0.0.0:8000
```

**Frontend dev** (en otra terminal):

```powershell
cd frontend
npm install
npm run dev                # Vite :5173, proxy /api /ws /hls → :8000
```

**Build producción** (el backend sirve `frontend/dist/` como SPA si existe):

```powershell
cd frontend; npm run build   # genera frontend/dist/
```

> **Regla de oro del agente:** NO iniciar `python -m backend` ni `npm run dev` durante una sesión, porque bloquea la consola. Si debe ejecutarse, hágalo el usuario final. Si por algún motivo se lanza algo en background, **terminarlo antes de cerrar**.

## Cómo se ve una cámara en la grilla

1. `Dashboard.tsx` llama `api.getCameras()` y **de-duplica por `ip` y por `id`**, descarta `enabled=false` y entradas sin ip/id (defensa en profundidad sobre el sanitizer del backend).
2. Para cada cámara crea un `CameraTile` con `wsUrl = /ws/mjpeg/{cam.id}` (WS, no índice).
3. `mjpeg_ws.py` → `mjpeg_manager.subscribe(camera_id, ws)` → `get_camera_by_id` → `build_rtsp_url(cam)` → arranca `ffmpeg` con `asyncio.create_subprocess_exec`, lee MJPEG del stdout y lo reenvía binario a los subscribers.
4. El hook `useMjpegWs` decodifica cada frame con `createImageBitmap` y lo dibuja en un `<canvas>`.
5. El `CameraTile` muestra siempre el badge REC (todas las cámaras graban siempre — ver "Grabación continua" más abajo).

**Si una cámara se ve duplicada en la grilla:** el dedup por ip del Dashboard la oculta. Si aun así aparece dos veces, revisar `cameras.json` — dos entradas con `ip` o `id` repetido (el sanitizer debería limpiarlas al arrancar backend).

## PTZ (pan-tilt-zoom)

Toda la grilla soporta PTZ:

- `usePtzWs(cameraId)` WS a `/ws/ptz/{cam.id}` → `ptz_ws.py` → `OnvifService.connect(ip, user, password)` puerto 2020.
- `useKeyboardPtz(cameraIds: string[], focusedCamera: string | null)` abre un WS PTZ por cada idFOCUSED y flechazos envían `{action:"move", pan, tilt}` / `{action:"stop"}`.
- `PTZPanel` con mouse (botones, presets, cruise, patrulla, LED).

**Si PTZ funciona pero el vídeo no:** ONVIF (2020) y RTSP (554) usan credenciales distintas en esa cámara, o el RTSP está deshabilitado en la app Tapo. Pasos: app Tapo → Camera Settings → Camera Account (mismo user/pass) → activar Third-Party Compatibility / RTSP. Reiniciar backend.

## Watchdog

`backend.services.watchdog` cada 10 s revisa HLS y DVR:

- HLS: si el proceso murió o `cam_<id>.m3u8` está stale (>20 s), restart con backoff exponencial 5→300 s.
- DVR: si el proceso murió, restart igual.
- En el primer fallo lanza `_detect_black_screen` (ffmpeg con `signalstats`, YAVG<16 > 10% → `black_detected=True`). El frontend muestra overlay "Pantalla negra detectada".

## Reglas para editar código

1. **Tipos:** `Camera.id` es `string` en TODO el stack. Mantenerlo así.
2. **No reports stderr a DEVNULL en ffmpeg.** Si necesitas diagnosticar un stream, abrir stderr y loguear líneas con `401|error|denied|refused|timeout|unauthorized`. El `mjpeg_manager` actual usa `asyncio.subprocess.DEVNULL` — esto es intencional para no palear el loop; si se habilita, ir con cuidado (puede llenar el buffer si nadie lee).
3. **Cualquier nueva cámara en la API** debe pasar por `add_camera` (que valida IP única). Nunca escribir directo en `cameras.json` saltándose la validación, salvo para mantener `id`/`ip` únicos.
4. **Frontend:** `Dashboard.tsx` debe de-duplicar por `ip`+`id`, nunca por `user` (dos cámaras distintas pueden compartir user `admin`). Cualquier listado de cámaras (`Config`, `Dvr`, selección de presets) debe operar por `cam.id`.
5. **No agregar dependencias** sin revisar `package.json` / `requirements.txt`. Evitar emojis en código/comentarios.
6. **Comentarios:** solo cuando pregunten. Código limpio > comentarios obvios.
7. **Testing:** no hay suite de tests en el repo todavía. Si se añade, usar pytest (backend) y vitest (frontend). Para validar manualmente, arrancar backend+frontend y abrir el dashboard.

## Arquitectura de streams (resumen)

| Función      | Servicio           | FFmpeg modo                                | Stream RTSP       | Salida            |
|--------------|--------------------|--------------------------------------------|-------------------|-------------------|
| Grilla MJPEG | `mjpeg_manager`    | `-i rtsp.. -vf scale=640:-2 -c:v mjpeg -f image2pipe pipe:1` | **sub** (stream2) | stdout → WS binario |
| Visor grande | `stream_manager`   | `-c:v copy -c:a copy -f hls -hls_time 1` | **sub** (stream2) | `cam_<id>.m3u8` + `.ts` |
| DVR          | `recording_service`| `-c:v copy -f segment -segment_time 3600` | **main** (stream1) | `cam_<id>/YYYYMMDD_HH.mp4` |
| Snapshot     | `snapshot_service` | `-frames:v 1`                              | **sub** (stream2) | `<name>_<ts>.jpg` |
| Black-detect | `watchdog`         | `-t 3 -vf signalstats -f null -`           | main (stream1)    | stderr parseado |

URL RTSP:
- **Main stream**: `rtsp://<user>:<password>@<ip>:554/<stream_path>` (campo `stream_path`, default `stream1`). Usada por DVR + watchdog black-detect.
- **Sub stream**: `rtsp://<user>:<password>@<ip>:554/<mjpeg_stream_path>` (campo `mjpeg_stream_path`, default `stream2`). Usada por grilla MJPEG, HLS y snapshots.

**IMPORTANTE — Por qué dos streams:** Las cámaras Tapo C500 solo permiten **1 sesión RTSP concurrente por stream**, no por cámara. Si el DVR (stream1) y la grilla MJPEG (stream1) tiran a la vez del mismo stream, uno recibe `Operation not permitted` y el tile se queda negro. Asignar el MJPEG/HLS/snapshots al sub stream (stream2) y dejar el main (stream1) sólo para DVR evita la contención. Si una cámara no tuviera stream2, se puede setear `mjpeg_stream_path` = `stream1` en `cameras.json`, pero entonces la grilla se pondrá negra mientras el DVR esté activo.

## Grabación continua (always-on DVR)

- **Todas las cámaras habilitadas graban siempre.** No hay botón de "Iniciar/Detener grabación" en la UI.
- Al arrancar el backend, `main._autostart_recording()` llama a `recording_service.start(id, url, name)` por cada cámara `enabled=true`.
- El watchdog (`_check_recordings`) **reinicia** la grabación si el proceso murió, y **arranca** la de cualquier cámara habilitada que no esté grabando (defensa always-on).
- Los `.mp4` se segmentan por hora: `cam_<id>/YYYYMMDD_HH.mp4`.
- El endpoint `POST /api/recordings/{id}/stop` sigue expuesto por compatibilidad, pero el watchdog lo reinicia en <=10 s. **No hay botón UI para detener.**
- La grilla (`CameraTile`) muestra siempre el badge REC.

### Carpeta de grabaciones

`backend.config.RECORDINGS_DIR = Path.home() / "Documents" / "TAPO" / "RECORDS"`

- Se crea sola al importar `backend.config` (`mkdir(parents=True, exist_ok=True)`).
- En Windows: `C:\Users\<usuario>\Documents\TAPO\RECORDS`.
- En Linux/macOS: `~/Documents/TAPO/RECORDS` (si `~/Documents` no existe, lo crea).
- El backend monta `/recordings/files` como StaticFiles sobre esa ruta. El frontend sirve los `.mp4` desde ahí.

## Diagnosticar "cámara no se ve"

1. `Test-NetConnection -ComputerName <ip> -Port 554` (RTSP) y `-Port 2020` (ONVIF).
2. `ffmpeg -rtsp_transport tcp -timeout 8000000 -i "rtsp://<user>:<pass>@<ip>:554/stream1" -frames:v 1 -f null - -an 2>&1 | Select-String "401|Error|refused|Duration"`.
3. Si 401 → app Tapo de esa cámara → Camera Account + Third-Party Compatibility. Si el password se cambia en la app, actualizar `cameras.json`.
4. Si la cámara responde a ONVIF pero no a RTSP con las mismas creds → cuenta RTSP desincronizada (conocido en Tapo C500). Apagar y re-encender Third-Party Compatibility.
5. Mira logs del backend: `Camera <id> ffmpeg: ...` o `Watchdog check error`.

## Estado actual (snapshot)

- Backend: totalmente migrado a `camera_id: str` (uuid 8 hex).
- Frontend: totalmente migrado a `cam.id` en Dashboard, PTZPanel, useKeyboardPtz, api.ts.
- Dedup: backend `_sanitize_cameras` (ip + id) + frontend `Dashboard.load` (ip + id).
- `cameras.json` tiene solo 2 cámaras: `mpfm40401` (192.168.239.51) y `mpfm4040 2 ` (192.168.239.52).
- Vista por defecto: `lmain` con `main_camera=b722100b`.

## Notas operativas

- `frontend/dist/` se sirve desde el mismo backend en producción (ver `main.py` `SPAIndex`). En dev, vite proxy.
- `backend/data/` se crea solo al arrancar (`config.py` mkdir). Si se borra, el backend lo recrea vacío.
- Las grabaciones van a `~/Documents/TAPO/RECORDS` (fuera del repo, por usuario). Se crea solo al importar `backend.config`.
- HLS segments se limpian solos (`delete_segments+append_list+omit_endlist`). DVR se limpia por `cleanup_old(retention_days)` corriendo en `_cleanup_loop` cada 1 h.
- Watchdog no gestiona MJPEG puntuales (grilla): si el WS no recibe frames, `useMjpegWs` reconecta con backoff exponencial propio.