# Bitácora de Desarrollo — Sistema de Vigilancia AgarVen

**Período completo:** 2026-07-10 al 2026-07-22 (13 días, 2 etapas)
**Repositorio web:** `C:\Users\AIT\Desktop\WebTapo` | remoto `https://github.com/creepyotakux-cyber/TAPOWEB.git`
**App de escritorio:** `C:\Users\AIT\TAPO\` (sin repositorio git)

**Desarrolladores:**
| Autor | Email | Rol | Commits (web) |
|-------|-------|-----|---------------|
| JeiiDev | jeiisonpasantias@gmail.com / creepyotakux@gmail.com | Desarrollador principal (pasante) | 27 (26 en main + 1 en master via GitHub) |
| xavcopilot | xavcopilot@gmail.com | Tercero (NO integrante del proyecto) | 12 |

> **Nota:** xavcopilot no es integrante del proyecto según instrucciones del desarrollador. Sus commits se documentan por integridad forense pero se atribuyen correctamente.

**Etapas del proyecto:**
| Etapa | Tecnología | Período | Ubicación | Git |
|-------|-----------|---------|-----------|-----|
| **1. App de Escritorio** | Python 3.14 + PySide6 (Qt6) + OpenCV | Jul 10-17, 2026 | `C:\Users\AIT\TAPO\` | No versionado |
| **2. App Web** | FastAPI + React 19 + FFmpeg | Jul 18-22, 2026 | `C:\Users\AIT\Desktop\WebTapo\` | Git → GitHub |

**Rama actual:** `main` @ `5f5c63c`
**Ramas:**
| Rama | HEAD | Estado |
|------|------|--------|
| `main` (local) | `5f5c63c` | Sincronizada con origin/main |
| `remotes/origin/main` | `5f5c63c` | Sincronizada |
| `remotes/origin/master` | `61371d6` | 2 commits (initial + rebranding), histórica |

**Stash pendiente:**
- `stash@{0}`: WIP on main desde `4980faa` (feat: all cameras same size in L+MAIN layout)
  - 5 archivos modificados, +169/-50 líneas
  - Contenido: `.vscode/settings.json`, `cameras.json`, `mjpeg_manager.py`, `stream_manager.py`, `Dashboard.tsx`
  - Fecha estimada: 2026-07-20 ~13:46 -0400 (basado en timestamp del merge commiteado)

**Total commits (web):** 39 (27 JeiiDev + 12 xavcopilot)
**Archivos fuente (escritorio):** 17 archivos .py (~127 KB) + assets + config
**Versión final:** Sin tag — HEAD `5f5c63c`

---

# ETAPA 1: App de Escritorio PySide6 (Julio 10-17, 2026)

> **Fuente de evidencia:** Metadatos de archivos NTFS (CreationTime/LastWriteTime), contenido de `AGENTS.md` del proyecto TAPO, archivos `.pyc` compilados, `debug.log`, `cameras.json`, `requirements.txt`. No hay repositorio git — toda la reconstrucción es por metadatos.

---

## 2026-07-10 (Jueves) — Inicio del proyecto

**Confianza:** Baja — inferido por CreationTime de `.python-version` y `.claude/settings.local.json`
**Evidencia:**
- `C:\Users\AIT\TAPO\.python-version` CreationTime: 2026-07-10 — contiene "3.14"
- `C:\Users\AIT\TAPO\.claude\settings.local.json` LastWriteTime: 2026-07-10

**Descripción:** Se crea el directorio del proyecto `C:\Users\AIT\TAPO\` y se configura Python 3.14 como versión del proyecto. Se establece la configuración local de Claude (agente IA). El proyecto se llama internamente "TAPO Camera Hub".

---

## 2026-07-14 (Lunes) — Scripts de prueba + Reverse engineering Tapo C500

**Confianza:** Media — LastWriteTime de 5 archivos de test + run.log
**Horas activas:** No determinable (sin git timestamps)
**Evidencia:**
- `test_c500_auth.py` (1,699 B) — Reverse engineering del handshake HTTPS de autenticación C500 (encrypt_type 3)
- `test_c500_light.py` (1,936 B) — Prueba de métodos de floodlight/LED vía pytapo
- `test_light.py` (4,198 B) — Handshake HTTPS de bajo nivel para control de luz
- `test_onvif_aux.py` (2,965 B) — Prueba de comandos ONVIF auxiliares (LEDOn/LEDOff, floodlight)
- `run.log` (426 B) — Primer log de ejecución registrado

**Descripción:** JeiiDev realiza ingeniería inversa de la API de Tapo C500 para controlar luces y autenticación. Prueba comandos ONVIF auxiliares. Los scripts revelan que se estaba explorando cómo controlar el floodlight de las cámaras Tapo C500, que usan autenticación HTTPS con encrypt_type 3 (diferente al C200 que usa RTSP directo).

---

## 2026-07-15 (Martes) — Core de la app + ONVIF PTZ + Configuración

**Confianza:** Media — LastWriteTime de 7 archivos fuente + requirements.txt + .env.example
**Evidencia:**
- `tapo.py` (9,271 B) — Herramienta CLI con pytapo para info, PTZ, stream, descarga de grabaciones
- `verify.py` (3,100 B) — Script de verificación de cámaras vía pytapo
- `requirements.txt` (91 B) — Dependencias: PySide6>=6.6.0, pytapo>=3.3.0, onvif-zeep>=0.2.12, opencv-python>=4.8.0, imageio-ffmpeg>=0.4.7
- `.env.example` (384 B) — Template de credenciales
- `.gitignore` (211 B) — Ignora cameras.json, .env, recordings, logs, venvs
- `gui/settings.py` (3,642 B) — Gestor de configuración con load/save/reorder de cámaras
- `gui/config_panel_qt.py` (9,061 B) — Panel de configuración: agregar/editar/eliminar cámaras
- `gui/onvif_ptz.py` (10,878 B) — Cliente ONVIF: conexión, continuous move, presets, cruise, patrol, LED
- `gui/theme.py` (10,214 B) — Glass Design System: DarkColors/LightColors, QSS completo
- `crash_log.txt` (0 B) — Log de crashes (vacío)
- `full_log.txt` (0 B) — Log completo (vacío)

**Descripción:** Se construye el core de la aplicación de escritorio. Se crea `tapo.py` como herramienta CLI para interactuar directamente con la API de Tapo. Se implementan los módulos base: configuración, cliente ONVIF PTZ, panel de configuración, y el sistema de temas "Glass Design System" con soporte dark/light. Se genera `requirements.txt` con las dependencias principales.

---

## 2026-07-16 (Miércoles) — GUI completa: Grilla + CameraTile + Tema

**Confianza:** Media — LastWriteTime de 6 archivos GUI + assets
**Evidencia:**
- `gui/camera_panel_qt.py` (11,781 B) — Panel de grilla configurable 2x2 a 6x6, drag-drop reorder, status bar, fullscreen
- `gui/camera_tile.py` (23,911 B) — Tile individual: RTSP via OpenCV, detección de movimiento, zoom/pan, grabación, snapshots, menú contextual
- `gui/settings.py` (3,642 B) — Última edición del gestor de settings
- `gui/theme.py` (10,214 B) — Última edición del tema Glass Design
- `assets/logo-agarcorp.png` (101,505 B) — Logo de AGARCORP (fecha del archivo: 2026-03-13, pre-existente)
- `snapshots/C500_20260716_132627.jpg` (138,634 B) — Primera snapshot de prueba de C500

**Descripción:** Se construye la interfaz gráfica completa. `camera_panel_qt.py` implementa la grilla de cámaras configurable con layouts simétricos (2x2 a 6x6) y drag-drop nativo de Qt. `camera_tile.py` es el módulo más grande (23.9 KB) — cada tile maneja su propio thread de streaming RTSP vía OpenCV `cv2.VideoCapture`, detección de movimiento con diferenciación de frames, grabación FFmpeg, y snapshots. Se guarda la primera snapshot de prueba de la cámara C500.

**Archivos borrados evidenciados por .pyc compilados:**
- `gui/camera_panel.py` → refactorizado a `camera_panel_qt.py`
- `gui/config_panel.py` → refactorizado a `config_panel_qt.py`

---

## 2026-07-17 (Jueves) — PTZ Window + MainWindow + Bug fixes críticos

**Confianza:** Media — LastWriteTime de 3 archivos principales + debug.log (2.1 MB)
**Evidencia:**
- `gui/main_window.py` (15,898 B) — Ventana principal con sidebar, navegación Dashboard/Config, gestión de ventanas PTZ, keyboard PTZ, toggle dark/light
- `gui/ptz_window_qt.py` (20,080 B) — Ventana PTZ: directional pad, speed slider, presets, cruise, patrol, LED, motion toggle
- `debug.log` (2,148,977 B = 2.1 MB) — Log de debug extenso indica sesión larga de desarrollo y testing

**Descripción:** Se implementan los dos módulos más complejos. `main_window.py` orquesta la app: sidebar con navegación, gestión de themes, threads para ONVIF ( ConnThread con QtSignal), keyboard PTZ global. `ptz_window_qt.py` es la ventana flotante de PTZ con controles direccionales, slider de velocidad, gestión de presets,巡航/patrol, control de LED/floodlight, y toggle de detección de movimiento.

**Bug fixes documentados en AGENTS.md (ocurridos durante desarrollo):**
1. **Thread zombi** — `_running` permanecía True tras error de red, tile nunca volvía a iniciar
2. **Miniaturas buggeadas** al cambiar layout — QPixmap cacheado sin invalidar en resize
3. **Tile más grande que las demás** al salir de fullscreen — stretches inconsistentes
4. **Fullscreen no funciona** — tile solo ocupaba 1 celda en vez de todo el grid
5. **Estilos inline rompen el grid** — setStyleSheet sobreescribe QSS global
6. **Recursión infinita _on_close** — cerrar ventana PTZ causaba loop infinito
7. **closeEvent masivo (~85s)** — stop_stream bloqueaba main thread por join+release
8. **light.connect() bloquea 30s** — ONVIF discovery en main thread
9. **PTZ callbacks bloquean** — operaciones ONVIF en main thread
10. **json.load sin try/except** — JSON corrupto crasheaba la app

**Archivos borrados evidenciados por .pyc:**
- `gui/app.py` → reemplazado por `main.py` (entry point simplificado)
- `gui/ptz_window.py` → refactorizado a `ptz_window_qt.py`
- `gui/tapo_light.py` → fusionado en `onvif_ptz.py`

---

## 2026-07-18 (Viernes previo al commit web) — Estado final de la app de escritorio

**Confianza:** Media — LastWriteTime de main.py y cameras.json
**Evidencia:**
- `main.py` (1,187 B) LastWriteTime: 2026-07-18 08:34 — Entry point final con _Tee para logging a debug.log
- `cameras.json` (808 B) LastWriteTime: 2026-07-18 11:09 — 3 cámaras: c200 (192.168.0.125), C500 (192.168.0.112), BASE (192.168.239.51)

**Descripción:** Última actividad registrada en la app de escritorio. El `main.py` ha sido simplificado a un entry point limpio de 52 líneas con redirección de stderr a `debug.log`. Las cámaras configuradas son: c200 en 192.168.0.125, C500 en 192.168.0.112, y BASE en 192.168.239.51 (la misma IP que aparecerá en la versión web).

**Estado final de la app de escritorio:**
- 17 archivos Python (~127 KB de código fuente)
- 9 módulos GUI + 5 scripts de test + 2 utilidades + 1 entry point
- Grilla configurable 2x2 a 6x6 con drag-drop
- Streaming RTSP via OpenCV en threads
- PTZ completo vía ONVIF (puerto 2020)
- Grabación bajo demanda por tile
- Detección de movimiento
- Tema dark/light "Glass Design System"
- 3 grabaciones de prueba (c200, 14 jul)
- 1 snapshot de prueba (C500, 16 jul)
- ~2.1 MB de logs de debug acumulados

### Grabaciones generadas por la app de escritorio

| Archivo | Tamaño | Fecha | Cámara |
|---------|--------|-------|--------|
| `recordings/c200_20260714_153545.mp4` | 182 KB | 2026-07-14 15:35 | c200 |
| `recordings/c200_20260714_153715.mp4` | 2.5 MB | 2026-07-14 15:37 | c200 |
| `recordings/c200_20260714_153844.mp4` | 2.3 MB | 2026-07-14 15:38 | c200 |
| `recordings/c200_20260716_102225.mp4` | 64 KB | 2026-07-16 10:22 | c200 |
| `snapshots/C500_20260716_132627.jpg` | 138 KB | 2026-07-16 13:26 | C500 |

---

## 2026-07-17 a 2026-07-18 — Transición: de Escritorio a Web

**Confianza:** Alta — cronología cruzada entre LastWriteTime de la app de escritorio y primer commit de la app web
**Descripción:** Entre el 17 y 18 de julio, JeiiDev toma la decisión de migrar la app de escritorio a una arquitectura web. La app de escritorio (PySide6) tenía limitaciones: era local, no accesible desde otros dispositivos, y el streaming RTSP dependía de OpenCV en el cliente. La versión web resuelve esto con:
- FastAPI en el servidor ejecuta FFmpeg → cualquier dispositivo con browser puede ver
- WebSocket MJPEG en vez de OpenCV CaptureThread
- ONVIF centralizado en el backend
- DVR always-on en el servidor (no en la máquina del usuario)
- React + Tailwind en vez de Qt widgets + QSS

La app de escritorio NO fue eliminada — sigue en `C:\Users\AIT\TAPO\` como referencia. No fue versionada con git.

---

# ETAPA 2: App Web — WebTapo (Julio 18-22, 2026)

---

## 2026-07-18 (Sábado) — Génesis del Proyecto Web

**Confianza:** Alta — 2 commits con timestamps + metadatos de archivos del mismo día
**Horas activas:** 15:05 — 15:58 (53 minutos)
**Rama:** `main` (local), `master` (remoto vía GitHub web)

### 15:05 — Commit inicial vacío (GitHub)
`b90c085` | 1 archivo | +2/-

- **Tipo:** Chore (inicialización de repo)
- **Autor:** JeiiDev (creepyotakux@gmail.com)
- **Descripción:** Commit automático de GitHub al crear el repositorio. Solo `README.md` con 2 líneas.
- **Nota forense:** Este commit fue hecho vía la interfaz web de GitHub (email noreply@github.com como committer). El repo se creó con nombre `TAPOWEB`.

### 15:58 — Upload completo del proyecto TAPOWEB
`daf95d7` | 53 archivos | +5,375/-

- **Tipo:** Feat (commit masivo inicial)
- **Autor:** JeiiDev (jeiisonpasantias@gmail.com)
- **Descripción:** Subida completa del sistema de vigilancia con estructura frontend+backend:
  - **Backend:** FastAPI con rutas cameras/ptz/recordings/snapshots/stream, servicios ONVIF/recording/snapshot/stream_manager/watchdog, WebSockets MJPEG y PTZ
  - **Frontend:** React 19 + Vite + TypeScript + Tailwind. Páginas Dashboard/Config/Dvr/Recordings. Componentes CameraTile/PTZPanel/Sidebar. Hooks useMjpegWs/usePtzWs/useKeyboardPtz
  - **Configuración:** .env.example, .gitignore, .vscode/settings.json
  - **Datos:** `backend/data/recordings/cam0/20260718_11.mp4` (973 KB, grabación de prueba)
- **Observaciones:** Incluye un `.mp4` de prueba commiteado (no debería estar en el repo). El proyecto ya estaba desarrollado localmente antes de este commit.

---

## 2026-07-19 (Domingo) — Rebranding + Configuración de Cámaras + L+MAIN

**Confianza:** Alta — 14 commits con timestamps + metadatos de archivos
**Horas activas:** 10:03 — 17:30 (~7.5 horas)
**Rama:** `main`

### 10:03 — Rebranding AGARCORP / AGARVEN + refactoring MJPEG
`61371d6` | 8 archivos | +274/-152

- **Tipo:** Feat/Refactor
- **Autor:** JeiiDev
- **Descripción:**
  - Renombramiento visual a "AGARCORP DE VENEZUELA C.A - Sistema de Vigilancia AGARVEN"
  - Nuevo logo: `frontend/src/assets/logo-agarcorp.png` (101 KB)
  - Sidebar rediseñada con módulos más grandes y borde visible
  - **Refactor mayor:** Extracción de lógica MJPEG de `mjpeg_ws.py` (115→6 líneas) a nuevo servicio `mjpeg_manager.py` (212 líneas) — separación de concerns
  - Hook `useMjpegWs` mejorado (+54/-16)

### 10:11 — Merge de histories (GitHub ↔ local)
`771cff2` | 1 archivo | +2/-

- **Tipo:** Merge
- **Autor:** JeiiDev
- **Descripción:** Merge de `origin/main` (que tenía el commit vacío `b90c085`) con el historial local. Resultado: README.md se mantiene.

### 10:42 — cameras.json al repo
`173af80` | 2 archivos | +53/-2

- **Tipo:** Chore
- **Autor:** JeiiDev
- **Descripción:** Agrega `cameras.json` al repositorio y remueve `cameras.json` del `.gitignore`. Contenido: 5 cámaras de prueba genéricas.

### 10:48 — Cámaras reales (2)
`2d9d6bf` | 1 archivo | +3/-30

- **Tipo:** Chore
- **Autor:** JeiiDev
- **Descripción:** Reemplaza las 5 cámaras genéricas por 2 cámaras reales: "Galpon" (192.168.239.51) y "base" (192.168.239.52).

### 10:51 — Restauración de 5 cámaras
`c70b5d5` | 1 archivo | +30/-3

- **Tipo:** Fix (revert parcial)
- **Autor:** JeiiDev
- **Descripción:** Restaura cameras.json con 5 cámaras. El developer cambió de opinión sobre la configuración.

### 10:56 — Cámaras expandidas a 6
`2fc17aa` | 1 archivo | +10/-1

- **Tipo:** Chore
- **Autor:** JeiiDev
- **Descripción:** Agrega la 6ª cámara al cameras.json.

### 15:18 — Optimizaciones PTZ + 5 cámaras Tapo [xavcopilot]
`deb2896` | 6 archivos | +110/-88

- **Tipo:** Feat/Refactor
- **Autor:** xavcopilot (TERCERO)
- **Descripción:**
  - Transport ONVIF persistente (timeout 3s vs 12s)
  - Feedback de estado por cada comando PTZ
  - Debounce de stop en teclado (30ms)
  - Dashboard siempre montado (cámaras no se apagan al cambiar de pestaña)
  - 5 cámaras Tapo C200/C500 configuradas
- **Archivos:** onvif_service.py, ptz_ws.py, App.tsx, useKeyboardPtz.ts, usePtzWs.ts, cameras.json

### 15:49 — Actualizar nombres de cámaras [xavcopilot]
`8a63d79` | 1 archivo | +2/-2

- **Tipo:** Chore
- **Autor:** xavcopilot (TERCERO)

### 15:53 — Agregar cámara base [xavcopilot]
`3e7d04f` | 1 archivo | +9/-

- **Tipo:** Feat
- **Autor:** xavcopilot (TERCERO)
- **Descripción:** Agrega cámara base 192.168.239.51.

### 16:11 — Vista L+MAIN + drag & drop [xavcopilot]
`c7d1d65` | 6 archivos | +326/-39

- **Tipo:** Feat
- **Autor:** xavcopilot (TERCERO)
- **Descripción:** Nueva vista de layout "L+MAIN" con drag & drop para reordenar la grilla. Instalación de `@dnd-kit/core` y `@dnd-kit/sortable`.

### 16:28 — L+MAIN layout L-shape [xavcopilot]
`4edc0da` | 1 archivo | +91/-38

- **Tipo:** Feat
- **Autor:** xavcopilot (TERCERO)
- **Descripción:** Layout en forma de L rodeando la cámara principal con sizing dinámico de thumbnails.

### 16:35 — Fix sync thumbH [xavcopilot]
`6e53ead` | 2 archivos | +9/-6

- **Tipo:** Fix
- **Autor:** xavcopilot (TERCERO)

### 16:43 — Fix CameraTile overflow [xavcopilot]
`eacc57c` | 2 archivos | +2/-2

- **Tipo:** Fix
- **Autor:** xavcopilot (TERCERO)

### 17:30 — L+MAIN: todas las cámaras mismo tamaño [xavcopilot]
`4980faa` | 1 archivo | +6/-5

- **Tipo:** Feat
- **Autor:** xavcopilot (TERCERO)
- **Descripción:** En la vista L+MAIN, todas las thumbnails tienen el mismo tamaño.

---

## 2026-07-20 (Lunes) — DVR Always-On + MJPEG + PTZ + Watchdog

**Confianza:** Alta — 12 commits con timestamps + stash + metadatos de archivos
**Horas activas:** 13:46 — 20:19 (~6.5 horas)
**Rama:** `main`

### 13:46 — Stash guardado
- **Tipo:** WIP stash
- **Autor:** JeiiDev
- **Descripción:** Se guardó un stash con 5 archivos modificados (+169/-50): cambios en mjpeg_manager.py, stream_manager.py, cameras.json, Dashboard.tsx, .vscode/settings.json. Esto indica que JeiiDev estaba trabajando en mejoras de streaming/cámaras y necesitó limpiar el working tree.

### 17:46 — Mega-commit: Grid 4x4 + LMAIN default + refactor completo [xavcopilot]
`54cacd4` | 24 archivos | +329/-330

- **Tipo:** Feat/Refactor
- **Autor:** xavcopilot (TERCERO)
- **Descripción:**
  - Agrega cámaras MPFM 10801 (10.10.30.51) y BASE MPFM (192.168.239.51)
  - Grid size default: 4, view_mode: lmain
  - **Refactor masivo:** 24 archivos backend+frontend migrados a `camera_id: str` en vez de índices enteros
  - .venv/ agregado a .gitignore
- **Nota:** Este commit se hizo sobre el estado que incluye el stash de JeiiDev, lo que sugiere que xavcopilot trabajó sobre el mismo working tree o hizo pull + stash pop.

### 14:59 — DVR always-on + sub-stream MJPEG + dedup + AGENTS.md
`790c169` | 16 archivos | +422/-168

- **Tipo:** Feat (MILESTONE)
- **Autor:** JeiiDev
- **Descripción:**
  - **DVR always-on:** autostart por `main._autostart_recording()`, watchdog reinicia si muere, `stop_all()` en shutdown
  - **Sub-stream:** DVR usa stream1 (main), MJPEG/HLS/snapshots usan stream2 (sub) — evita "Operation not permitted" en Tapo C500
  - **Dedup:** `_sanitize_cameras` en backend (ip + id), Dashboard dedup por ip + id
  - **RECORDINGS_DIR:** `~/Documents/TAPO/RECORDS` (per-user, auto-created)
  - **AGENTS.md:** 214 líneas de documentación del proyecto
  - .gitignore expandido: hls/, recordings/, snapshots/, .opencode/, test_cam.jpg

### 16:30 — DVR stuck segment detection + stderr logging
`927dff2` | 2 archivos | +120/-10

- **Tipo:** Fix
- **Autor:** JeiiDev
- **Descripción:**
  - `_delete_stale_current_segment`: elimina mp4 de 0 bytes o stale >60s antes de arrancar FFmpeg
  - stderr capturado y logueado para líneas con 401/error/denied/refused/timeout
  - DVR omite el segmento en progreso (moov no flusheado)
  - Watchdog: `_is_recording_stuck` detecta FFmpeg vivo pero segmento 0 bytes >90s

### 18:23 — MJPEG self-restart + watchdog status + UI states
`b0bf7ad` | 6 archivos | +256/-75

- **Tipo:** Feat
- **Autor:** JeiiDev
- **Descripción:**
  - **mjpeg_manager:** `_runner` task auto-reinicia FFmpeg con backoff exponencial (2→60s)
  - Heartbeat cada 10s, cierra WS zombie
  - 3 estados UI: LIVE / Reconectando... / Sin conexión
  - Cámaras agregadas: PRUEBA, MPFM 1080 1, MPFM 1080 2

### 18:59 — PTZ WS fail-fast + UI error state
`ab96285` | 4 archivos | +72/-22

- **Tipo:** Fix
- **Autor:** JeiiDev
- **Descripción:**
  - ptz_ws: `asyncio.wait_for(timeout=12s)` en `onvif.connect`, envía error y cierra WS
  - onvif: max_retries 3→1, timeouts reducidos
  - PTZPanel: overlay de error con AlertTriangle + auto-reconnect backoff

### 19:36 — Patrol sweep global + SweepLauncher
`93153ff` | 5 archivos | +128/-12

- **Tipo:** Feat
- **Autor:** JeiiDev
- **Descripción:** Patrullaje automático PTZ global (todas las cámaras) con `sweep_patrol` en onvif_service. SweepLauncher per-camera en Dashboard.

### 20:07 — Fix stop() dead code
`1d1436a` | 1 archivo | +2/-

- **Tipo:** Fix
- **Autor:** JeiiDev
- **Descripción:** Habilita método `stop()` en RecordingService que estaba muerto — necesario para restart/cleanup del DVR.

### 20:10 — Fix Vite proxy para /recordings
`3a3d1cc` | 1 archivo | +1/-

- **Tipo:** Fix
- **Autor:** JeiiDev
- **Descripción:** Agrega `/recordings` al proxy de Vite dev — los segmentos DVR no se proxyaban al backend.

### 20:15 — Fix ONVIF timeouts para cámaras lentas
`7543d8c` | 1 archivo | +2/-2

- **Tipo:** Fix
- **Autor:** JeiiDev
- **Descripción:** Aumenta timeouts ONVIF transport a 10s/5s para cámaras que responden lento.

### 20:19 — ONVIF pre-connect + sweep params
`7dca9c1` | 3 archivos | +33/-5

- **Tipo:** Perf
- **Autor:** JeiiDev
- **Descripción:**
  - Pre-conexión ONVIF al startup para todas las cámaras habilitadas
  - Sweep params optimizados: speed 0.7, step 0.8s, pause 0.3s

---

## 2026-07-21 (Martes) — DVR Playback + Remux + Validación

**Confianza:** Alta — 8 commits con timestamps + metadatos de archivos
**Horas activas:** 08:38 — 14:23 (~5.75 horas)
**Rama:** `main`

### 08:38 — DVR segment validation + auto-refresh + orphan cleanup
`b51b74f` | 6 archivos | +215/-24

- **Tipo:** Feat (MILESTONE)
- **Autor:** JeiiDev
- **Descripción:**
  - Backend: mata procesos FFmpeg huérfanos al startup (psutil)
  - ffprobe moov atom validation en `is_segment_playable()`
  - Nuevo endpoint `GET /api/recordings/check` para pre-validación
  - Stream endpoint sin Content-Disposition (inline playback)
  - Frontend: auto-refresh DVR calendar+hours cada 30s
  - Pre-validación de segmento antes de cargar el video player
  - Retry logic (2x, 2s delay) + mensajes de error específicos

### 09:11 — Misc DVR improvements
`856e4e2` | 2 archivos | +12/-7

- **Tipo:** Fix
- **Autor:** JeiiDev

### 10:47 — Replay de segments in-progress si moov está listo
`8dad07c` | 4 archivos | +15/-16

- **Tipo:** Feat
- **Autor:** JeiiDev
- **Descripción:** Permite reproducir segmentos DVR en progreso si el átomo moov ya fue escrito (verificación con ffprobe).

### 11:36 — On-demand remux para segments in-progress
`2f5ffff` | 4 archivos | +97/-11

- **Tipo:** Feat
- **Autor:** JeiiDev
- **Descripción:** Si el moov no está listo, se hace remux on-demand con FFmpeg para generar un mp4 reproducible.

### 12:28 — prepareRecording como POST async
`51d07ab` | 3 archivos | +78/-70

- **Tipo:** Fix
- **Autor:** JeiiDev
- **Descripción:** Cambia `prepareRecording` de GET a POST async para evitar timeout del navegador durante el remux.

### 13:41 — Restaurar get_recording_path
`6a4bbcc` | 1 archivo | +10/-

- **Tipo:** Fix
- **Autor:** JeiiDev
- **Descripción:** Restaura método `get_recording_path` eliminado accidentalmente durante la edición de prepare_segment.

### 13:46 — Click en segments in-progress
`337152f` | 1 archivo | +5/-4

- **Tipo:** Fix
- **Autor:** JeiiDev
- **Descripción:** Permite clickear segmentos en progreso — VideoPlayer auto-prepara si moov no está listo.

### 14:23 — Fix prepare_segment: moov not ready fast
`649f7ac` | 2 archivos | +17/-43

- **Tipo:** Fix
- **Autor:** JeiiDev
- **Descripción:** Simplifica prepare_segment: si el archivo in-progress no tiene moov, muestra mensaje claro de usar Dashboard para vista live en vez de intentar copiar.

---

## 2026-07-22 (Miércoles) — Timezone + HLS Live + Restore-Backup

**Confianza:** Alta — 3 commits con timestamps + metadatos de archivos
**Horas activas:** 14:41 — 19:24 (~4.7 horas)
**Rama:** `main`

### 14:41 — Timezone America/Caracas + fragmented MP4
`6c4881f` | 5 archivos | +59/-14

- **Tipo:** Feat
- **Autor:** xavcopilot (TERCERO)
- **Descripción:**
  - Backend: timezone explícita America/Caracas en config
  - Fragmented MP4 con `movflags=+frag_keyframe` para playback de segments in-progress
  - Vite host: 0.0.0.0 (accesible en red local)
  - Snapshot y watchdog ajustados a la timezone

### 18:38 — HLS live playback para DVR in-progress + data loss prevention
`36e2c5d` | 7 archivos | +98/-7

- **Tipo:** Feat (MILESTONE)
- **Autor:** xavcopilot (TERCERO)
- **Descripción:**
  - Dual FFmpeg output: DVR mp4 + HLS desde el mismo stream RTSP (sin contención)
  - hls.js dynamic import para segments in-progress con seek + live continuation
  - Renombra segmento existente antes de que FFmpeg lo sobreescriba (prevención de pérdida de datos)
  - `_pause` flag: watchdog + autostart ignoran cámaras con archivo `_pause`
  - `sessionStorage` para persistencia de página activa entre refreshes
  - movflags simplificado a `+frag_keyframe` (fixed empty moov causing browser hang)
  - **Nueva dependencia:** hls.js en frontend

### 19:24 — restore-backup picks largest file + SERVIDOR marker
`5f5c63c` | 2 archivos | +31/-1

- **Tipo:** Fix
- **Autor:** xavcopilot (TERCERO)
- **Descripción:**
  - restore_backup selecciona el archivo más grande (en vez del primero)
  - Archivo `SERVIDOR` creado como marker de que el backend está corriendo en un servidor
  - recording_service: +32 líneas de lógica de backup

---

## Sin datos — Períodos de inactividad

- **Jul 10-13:** Inactividad de 3 días después de crear el proyecto. Solo `.python-version` y `.claude/` tienen evidencia del día 10. Sin actividad registrada del 11 al 13.
- **Jul 14-17:** Actividad continua de la app de escritorio (5 días).
- **Jul 18-22:** Actividad continua de la app web (5 días).
- No hay gaps mayores a 3 días entre la primera actividad (Jul 10) y la última (Jul 22).

---

## Arquitectura Etapa 1: App de Escritorio (C:\Users\AIT\TAPO\)

```
TAPO/                                    # Sin git — solo metadatos NTFS
├── main.py                              # Entry point PySide6 + _Tee logging (52 líneas)
├── tapo.py                              # CLI con pytapo (info, PTZ, stream, download)
├── verify.py                            # Verificación de cámaras
├── cameras.json                         # 3 cámaras: c200, C500, BASE
├── requirements.txt                     # PySide6, pytapo, onvif-zeep, opencv, imageio-ffmpeg
├── AGENTS.md                            # Arquitectura + bug history (173 líneas)
├── .python-version                      # "3.14"
├── .env.example                         # Template credenciales
├── .gitignore                           # cameras.json, .env, recordings, logs
├── debug.log                            # 2.1 MB de logs de debug
├── run.log / crash_log.txt / full_log.txt
├── assets/
│   └── logo-agarcorp.png                # Logo AGARCORP (101 KB, pre-existente)
├── recordings/                          # Grabaciones bajo demanda
│   ├── c200_20260714_153545.mp4         # 182 KB
│   ├── c200_20260714_153715.mp4         # 2.5 MB
│   ├── c200_20260714_153844.mp4         # 2.3 MB
│   └── c200_20260716_102225.mp4         # 64 KB
├── snapshots/
│   └── C500_20260716_132627.jpg         # 138 KB
├── gui/
│   ├── __init__.py                      # Exporta MainWindow
│   ├── main_window.py                   # Sidebar + Dashboard/Config + PTZ mgmt (474 líneas)
│   ├── camera_panel_qt.py              # Grilla 2x2→6x6 + drag-drop + fullscreen (312 líneas)
│   ├── camera_tile.py                   # RTSP OpenCV + motion + record + snapshot (631 líneas)
│   ├── config_panel_qt.py              # ABM cámaras + dialog (256 líneas)
│   ├── ptz_window_qt.py                # PTZ pad + presets + cruise + LED (580 líneas)
│   ├── onvif_ptz.py                     # Cliente ONVIF completo (310 líneas)
│   ├── settings.py                      # Load/save cameras.json (115 líneas)
│   ├── theme.py                         # Glass Design System dark/light (538 líneas)
│   └── __pycache__/                     # Evidencia de archivos borrados (5 .pyc)
└── test_*.py                            # 5 scripts de test/debug
```

## Arquitectura Etapa 2: App Web (C:\Users\AIT\Desktop\WebTapo\)

```
WebTapo/
├── .env.example                          # Variables de entorno de ejemplo
├── .gitignore                            # Ignorar hls/, recordings/, snapshots/, .opencode/
├── .opencode/                            # Configuración de opencode (agente IA)
│   ├── plans/camera-lag-fix.md           # Plan de diagnóstico
│   ├── package.json / package-lock.json
│   └── .gitignore
├── .vscode/settings.json                 # Configuración VS Code
├── AGENTS.md                             # Guía del proyecto para agentes IA (214 líneas)
├── README.md                             # README mínimo
├── SERVIDOR                              # Marker de servidor activo (0 bytes)
├── BITACORA_FORENSE.md                   # Este documento
├── backend/
│   ├── __init__.py
│   ├── __main__.py                       # python -m backend → uvicorn :8000
│   ├── config.py                         # cameras.json, build_rtsp_url, dirs (4.1 KB)
│   ├── main.py                           # FastAPI app, lifespan, SPA mount (6.1 KB)
│   ├── models.py                         # Pydantic models (862 B)
│   ├── requirements.txt                  # FastAPI, uvicorn, onvif-zeep, psutil, etc.
│   ├── data/
│   │   ├── cameras.json                  # Configuración de 2 cámaras (1.3 KB)
│   │   └── recordings/cam_b722100b/      # DVR segmentado (en vivo)
│   ├── routers/
│   │   ├── cameras.py                    # CRUD + settings (3.7 KB)
│   │   ├── ptz.py                        # ONVIF PTZ REST (2.8 KB)
│   │   ├── recordings.py                 # DVR calendar/hours/check/prepare (3.1 KB)
│   │   ├── snapshots.py                  # Captura puntual (1.1 KB)
│   │   └── stream.py                     # HLS start/stop/playlist (1.2 KB)
│   ├── services/
│   │   ├── mjpeg_manager.py              # MJPEG por WS con auto-restart (10.9 KB)
│   │   ├── onvif_service.py              # Cliente ONVIF puerto 2020 (10 KB)
│   │   ├── recording_service.py          # DVR fragmentado + remux + HLS (22.5 KB)
│   │   ├── snapshot_service.py           # 1 frame (2.1 KB)
│   │   ├── stream_manager.py             # HLS subprocess (3.6 KB)
│   │   └── watchdog.py                   # Monitor HLS+DVR+MJPEG (12.5 KB)
│   └── ws/
│       ├── mjpeg_ws.py                   # /ws/mjpeg/{camera_id} (365 B)
│       └── ptz_ws.py                     # /ws/ptz/{camera_id} (5.5 KB)
└── frontend/
    ├── .gitignore
    ├── .oxlintrc.json
    ├── index.html
    ├── package.json                      # React 19, Vite, Tailwind v4, dnd-kit, hls.js
    ├── package-lock.json                 # 62 KB
    ├── vite.config.ts                    # Proxy /api /ws /hls /recordings → :8000
    ├── public/
    │   ├── favicon.svg
    │   └── icons.svg
    └── src/
        ├── App.tsx                       # Layout + theme + session persistence (1.5 KB)
        ├── index.css                     # Tailwind base (2.7 KB)
        ├── main.tsx                      # Entry point (226 B)
        ├── assets/
        │   ├── hero.png
        │   ├── logo-agarcorp.png         # Logo AGARVEN (101 KB)
        │   └── vite.svg
        ├── components/
        │   ├── CameraTile.tsx            # Tile con LIVE/Reconectando/Sin conexión (7.6 KB)
        │   ├── PTZPanel.tsx              # Panel PTZ con presets/cruise/sweep/LED (8.3 KB)
        │   └── Sidebar.tsx               # Navegación lateral (2.2 KB)
        ├── hooks/
        │   ├── useKeyboardPtz.ts         # PTZ por teclado (3.9 KB)
        │   ├── useMjpegWs.ts             # WebSocket MJPEG + createImageBitmap (3.4 KB)
        │   └── usePtzWs.ts              # WebSocket PTZ + backoff reconexión (3.9 KB)
        ├── lib/
        │   └── api.ts                    # Cliente API + tipos (4.8 KB)
        └── pages/
            ├── Config.tsx                # ABM cámaras (6 KB)
            ├── Dashboard.tsx             # Grilla + L+MAIN + DnD (19 KB)
            ├── Dvr.tsx                   # DVR calendar/hours/player + HLS live (23.9 KB)
            └── Recordings.tsx            # Grabaciones antiguas (3.8 KB)
```

---

## Huella digital de ramas

| Rama | HEAD Commit | Estado | Descripción |
|------|-------------|--------|-------------|
| `main` (local) | `5f5c63c` | Sincronizada con origin/main | Rama principal de desarrollo |
| `remotes/origin/main` | `5f5c63c` |同步 | Push remoto |
| `remotes/origin/master` | `61371d6` | Histórica (2 commits) | Solo tiene initial commit + rebranding; fue renombrada a main |

---

## Stash pendiente

| Stash | Base Commit | Fecha estimada | Archivos | Diff |
|-------|-------------|----------------|----------|------|
| `stash@{0}` | `4980faa` (feat: all cameras same size in L+MAIN layout) | 2026-07-20 ~13:46 | 5 | +169/-50 |

**Contenido del stash:** Cambios en mjpeg_manager.py (+137/-27), stream_manager.py (+30), cameras.json (+39/-4), Dashboard.tsx (+8), .vscode/settings.json (+5). Este stash probablemente contiene trabajo previo de JeiiDev sobre streaming y cámaras que fue stashado antes de que xavcopilot hiciera su mega-commit `54cacd4`.

---

## Pull Requests / Merges

| Evento | Rama Origen | Rama Destino | Autor | Fecha | Descripción |
|--------|-------------|-------------|-------|-------|-------------|
| Merge commit | `b90c085` (GitHub) | `61371d6` (local) | JeiiDev | 2026-07-19 10:11 | Merge de histories: README.md del GitHub initial commit |

No se usaron Pull Requests formales. Todo el desarrollo se hizo directamente en `main`.

---

## Estadísticas

| Métrica | Escritorio (Etapa 1) | Web (Etapa 2) | Total |
|---------|---------------------|---------------|-------|
| **Período** | Jul 10-17 (8 días) | Jul 18-22 (5 días) | Jul 10-22 (13 días) |
| **Commits git** | 0 (sin repo) | 39 | 39 |
| **Archivos fuente** | 17 .py (~127 KB) | ~65 archivos (~309 KB) | ~82 archivos (~436 KB) |
| **Autores** | JeiiDev (100%) | JeiiDev (69%) + xavcopilot (31%) | JeiiDev + xavcopilot |
| **Framework UI** | PySide6 (Qt6) | React 19 + Tailwind | PySide6 → React |
| **Streaming** | OpenCV cv2.VideoCapture | FFmpeg subprocess → WebSocket | OpenCV → FFmpeg |
| **Config storage** | `cameras.json` en raíz | `cameras.json` en `backend/data/` | Reubicado |
| **Identity model** | Tuple (ip, user, password, name) | String id (8 hex chars) | Migrado |
| **Recording** | Bajo demanda por tile | Always-on DVR segmentado | Evolucionado |
| **Días activos** | ~5 de 8 | 5 de 5 | ~10 de 13 |

| Métrica (solo web) | Valor |
|--------------------|-------|
| **Total commits** | 39 |
| **Commits por día** | Jul 18: 2 · Jul 19: 14 · Jul 20: 12 · Jul 21: 8 · Jul 22: 3 |
| **Autores** | 2 (JeiiDev: 27, xavcopilot: 12) |
| **Commits de JeiiDev** | 27 (69%) |
| **Commits de xavcopilot** | 12 (31%) |
| **PRs formales** | 0 |
| **Ramas** | 3 (main local, origin/main, origin/master) |
| **Stash pendientes** | 1 |
| **Archivos totales (repo)** | 65 |
| **Tamaño total (repo)** | ~36 MB (incluye node_modules si están presentes) |
| **Archivos fuente** | ~309 KB (py/tsx/ts/json/css/html/md) |
| **Primera actividad (escritorio)** | 2026-07-10 (CreationTime de .python-version) |
| **Primera actividad (web)** | 2026-07-18 15:05 -0400 |
| **Última actividad** | 2026-07-22 19:24 +0000 |
| **Duración total del proyecto** | 13 días |
| **Días activos totales** | ~10 de 13 (77%) |
| **Versión** | Sin tag — HEAD: `5f5c63c` |

---

## Tecnologías

| Categoría | Tecnología | Rol | Etapa |
|-----------|------------|-----|-------|
| **Escritorio** | Python 3.14 | Lenguaje de la app de escritorio | 1 |
| | PySide6 (Qt6) | Framework GUI de escritorio | 1 |
| | OpenCV (cv2) | Streaming RTSP + procesamiento de frames | 1 |
| | pytapo | API directa de Tapo (CLI, luz, info) | 1 |
| **Backend web** | Python 3.12+ | Lenguaje del servidor | 2 |
| | FastAPI | Framework web async + OpenAPI automático | 2 |
| | Uvicorn | Servidor ASGI | 2 |
| | Pydantic | Validación de modelos (CameraCreate, PTZCommand, etc.) | 2 |
| | onvif-zeep | Cliente ONVIF para PTZ (puerto 2020) | 1+2 |
| | psutil | Detección de procesos FFmpeg huérfanos | 2 |
| **Frontend web** | React 19 | Framework UI | 2 |
| | TypeScript | Tipado estático | 2 |
| | Vite | Build tool + dev server | 2 |
| | Tailwind CSS v4 | Utility-first CSS | 2 |
| | @dnd-kit/core + sortable | Drag & drop para reorder de grilla | 2 |
| | hls.js | Reproducción HLS en browser (segments in-progress) | 2 |
| **Streaming** | FFmpeg | Transcodificación MJPEG, HLS, DVR, remux, snapshots | 2 |
| | RTSP | Protocolo de streaming de cámaras (puerto 554) | 1+2 |
| | HLS | HTTP Live Streaming para playback en browser | 2 |
| | WebSocket | MJPEG frames y comandos PTZ en tiempo real | 2 |
| **Cámaras** | Tapo C200 / C500 | Cámaras IP con ONVIF + RTSP | 1+2 |
| | ONVIF | Protocolo de control PTZ (puerto 2020) | 1+2 |
| **Herramientas** | Git | Control de versiones | 2 |
| | GitHub | Repositorio remoto | 2 |
| | opencode | Agente IA para asistencia de desarrollo | 2 |
| | VS Code | IDE de desarrollo | 1+2 |
| | Claude (Anthropic) | Agente IA para desarrollo (app de escritorio) | 1 |

---

## Línea de tiempo resumida

```
═══════════════════════════════════════════════════════════════════
  ETAPA 1: APP DE ESCRITORIO PySide6 (C:\Users\AIT\TAPO\)
  Sin git — reconstruida por metadatos NTFS
═══════════════════════════════════════════════════════════════════

2026-07-10 (Jue)
  └─ ★ PROYECTO CREADO — .python-version "3.14", .claude config

2026-07-14 (Lun)
  └─ Scripts de prueba Tapo C500 — auth, light, ONVIF aux (5 archivos)

2026-07-15 (Mar)
  └─ ★★ CORE APP — tapo.py CLI, requirements, settings, ONVIF PTZ,
            theme Glass Design, config panel, .env, .gitignore

2026-07-16 (Mié)
  └─ ★★★ GUI COMPLETA — camera_panel_qt (grilla 6x6),
            camera_tile (RTSP+motion+record), logo AGARCORP,
            primera snapshot C500

2026-07-17 (Jue)
  └─ main_window (sidebar+navegación), ptz_window_qt (PTZ completo),
     10 bug fixes documentados, debug.log crece a 2.1 MB

2026-07-18 (Vie/Sáb)
  └─ Estado final escritorio: 3 cámaras, 17 archivos .py, 5 grabaciones

2026-07-17→18 ──★ TRANSICIÓN: Decisión de migrar de PySide6 a FastAPI+React

═══════════════════════════════════════════════════════════════════
  ETAPA 2: APP WEB — WebTapo (C:\Users\AIT\Desktop\WebTapo\)
  Git → GitHub — 39 commits
═══════════════════════════════════════════════════════════════════

2026-07-18 (Sáb)
  ├─ 15:05  ★ REPO CREADO en GitHub (commit vacío)
  └─ 15:58  ★★ PROYECTO COMPLETO SUBIDO (53 archivos, +5,375 líneas)
             │    Backend FastAPI + Frontend React + DVR + MJPEG + PTZ
             │
2026-07-19 (Dom)
  ├─ 10:03  Rebranding AGARVEN + refactor MJPEG → mjpeg_manager
  ├─ 10:11  Merge histories (GitHub ↔ local)
  ├─ 10:42  cameras.json al repo
  ├─ 10:48  Cámaras reales configuradas (2 → 5 → 6)
  ├─ 15:18  [xavcopilot] Optimizaciones PTZ + 5 cámaras Tapo
  ├─ 16:11  [xavcopilot] ★ Vista L+MAIN + drag & drop
  ├─ 16:28  [xavcopilot] L+MAIN layout L-shape
  ├─ 16:35  [xavcopilot] Fix thumb heights
  ├─ 16:43  [xavcopilot] Fix CameraTile overflow
  └─ 17:30  [xavcopilot] L+MAIN: mismo tamaño thumbnails
             │
2026-07-20 (Lun)
  ├─ 13:46  Stash guardado (WIP streaming improvements)
  ├─ 14:59  ★★★ DVR ALWAYS-ON + SUB-STREAM + DEDUP + AGENTS.md
  ├─ 16:30  DVR stuck detection + stderr logging
  ├─ 17:46  [xavcopilot] Mega-refactor: grid 4x4, camera_id migration
  ├─ 18:23  MJPEG self-restart + watchdog status + 3 UI states
  ├─ 18:59  PTZ fail-fast + error overlay
  ├─ 19:36  Patrol sweep global PTZ
  ├─ 20:07  Fix stop() dead code
  ├─ 20:10  Fix Vite proxy /recordings
  ├─ 20:15  Fix ONVIF timeouts
  └─ 20:19  ONVIF pre-connect + sweep optimization
             │
2026-07-21 (Mar)
  ├─ 08:38  ★ DVR segment validation + orphan cleanup + auto-refresh
  ├─ 09:11  Misc DVR improvements
  ├─ 10:47  Replay segments in-progress (moov check)
  ├─ 11:36  On-demand remux (moov not ready)
  ├─ 12:28  prepareRecording POST async
  ├─ 13:41  Fix: restore get_recording_path
  ├─ 13:46  Fix: click in-progress segments
  └─ 14:23  Fix: prepare_segment fast path
             │
2026-07-22 (Mié)
  ├─ 14:41  [xavcopilot] Timezone + fragmented MP4 + vite host 0.0.0.0
  ├─ 18:38  [xavcopilot] ★★ HLS LIVE PLAYBACK + DATA LOSS PREVENTION
  └─ 19:24  [xavcopilot] restore-backup + SERVIDOR marker
             │
             ▼
         ESTADO ACTUAL (Ambas etapas):
         Etapa 1: App escritorio PySide6 en C:\Users\AIT\TAPO\ (sin git)
         Etapa 2: App web en WebTapo (39 commits, HEAD: 5f5c63c)
         2 cámaras activas, DVR always-on, MJPEG auto-restart,
         PTZ con sweep patrol, HLS live para segments in-progress
```

---

*Documento generado el 2026-07-22 por agente forense. Fuentes Etapa 1: metadatos de archivos NTFS (CreationTime/LastWriteTime), contenido de AGENTS.md, archivos .pyc compilados, debug.log, cameras.json, requirements.txt. Fuentes Etapa 2: git log, git reflog, git branch, git stash, metadatos de archivos NTFS, contenido de commits (git show --stat).*
