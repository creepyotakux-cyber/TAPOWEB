import threading
import time
from concurrent.futures import ThreadPoolExecutor


class OnvifService:
    def __init__(self):
        self._cam = None
        self._ptz = None
        self._media = None
        self._profile_token: str | None = None
        self._lock = threading.Lock()
        self._connect_lock = threading.Lock()
        self._connected = False
        self._patrol_stop: threading.Event | None = None
        self._cruise_stop: threading.Event | None = None
        self._light_on = False
        self._executor = ThreadPoolExecutor(max_workers=2, thread_name_prefix="onvif")
        self._transport = None
        self._fast_transport = None

    @property
    def is_connected(self) -> bool:
        return self._connected

    def _require(self):
        if not self._connected or not self._ptz or not self._profile_token:
            raise RuntimeError("ONVIF not connected")

    def connect(self, ip: str, user: str, password: str, port: int = 2020, max_retries: int = 3) -> dict:
        with self._connect_lock:
            if self._connected and self._ptz is not None:
                return {"success": True, "profile_token": self._profile_token, "presets": self.get_presets()}
            last_err = None
            for attempt in range(max_retries):
                try:
                    from onvif import ONVIFCamera
                    from zeep import Transport
                    self._transport = Transport(timeout=5, operation_timeout=5)
                    self._fast_transport = Transport(timeout=3, operation_timeout=3)
                    self._cam = ONVIFCamera(ip, port, user, password, transport=self._transport)
                    self._cam.host = ip
                    for ns in list(self._cam.xaddrs.keys()):
                        old = self._cam.xaddrs[ns]
                        if old:
                            self._cam.xaddrs[ns] = old.replace(old.split("://")[1].split(":")[0], ip)
                    self._media = self._cam.create_media_service()
                    profiles = self._media.GetProfiles()
                    if not profiles:
                        raise RuntimeError("No media profiles found")
                    self._profile_token = profiles[0].token
                    self._ptz = self._cam.create_ptz_service()
                    self._ptz.zeep_client.transport = self._fast_transport
                    self._connected = True
                    try:
                        presets = self.get_presets()
                    except Exception:
                        presets = []
                    return {"success": True, "profile_token": self._profile_token, "presets": presets}
                except Exception as e:
                    last_err = e
                    if attempt < max_retries - 1:
                        time.sleep(1 + attempt)
            self._connected = False
            return {"success": False, "error": str(last_err)}

    def continuous_move(self, pan: float, tilt: float) -> bool:
        if not self._connected or not self._ptz or not self._profile_token:
            return False
        try:
            self._ptz.ContinuousMove({
                "ProfileToken": self._profile_token,
                "Velocity": {"PanTilt": {"x": float(pan), "y": float(tilt)}},
            })
            return True
        except Exception:
            self._connected = False
            return False

    def stop(self) -> bool:
        if not self._connected or not self._ptz or not self._profile_token:
            return False
        try:
            self._ptz.Stop({
                "ProfileToken": self._profile_token,
                "PanTilt": True,
                "Zoom": True,
            })
            return True
        except Exception:
            self._connected = False
            return False

    def set_led(self, enabled: bool) -> bool:
        self._require()
        with self._lock:
            try:
                self._ptz.SendAuxiliaryCommand({
                    "ProfileToken": self._profile_token,
                    "AuxiliaryData": "LEDOn" if enabled else "LEDOff",
                })
                self._light_on = enabled
                return True
            except Exception:
                return False

    def get_presets(self) -> list[dict]:
        self._require()
        with self._lock:
            try:
                raw = self._ptz.GetPresets({"ProfileToken": self._profile_token})
                return [{"token": str(p.token) if p.token else "", "name": str(p.Name) if p.Name else "Sin nombre"} for p in raw]
            except Exception:
                return []

    def set_preset(self, name: str) -> str:
        self._require()
        with self._lock:
            resp = self._ptz.SetPreset({"ProfileToken": self._profile_token, "PresetName": str(name)})
            return str(resp)

    def goto_preset(self, preset_token: str) -> bool:
        self._require()
        with self._lock:
            try:
                self._ptz.GotoPreset({
                    "ProfileToken": self._profile_token,
                    "PresetToken": preset_token,
                    "Speed": {"PanTilt": {"x": 0.5, "y": 0.5}},
                })
                return True
            except Exception:
                self._connected = False
                return False

    def remove_preset(self, preset_token: str):
        self._require()
        with self._lock:
            self._ptz.RemovePreset({"ProfileToken": self._profile_token, "PresetToken": preset_token})

    def goto_home(self) -> bool:
        self._require()
        with self._lock:
            try:
                self._ptz.GotoHomePosition({
                    "ProfileToken": self._profile_token,
                    "Speed": {"PanTilt": {"x": 0.5, "y": 0.5}},
                })
                return True
            except Exception:
                return False

    def cruise_horizontal(self, speed: float = 0.5):
        self._cruise_stop = threading.Event()
        direction = [1]

        def _loop():
            stop = self._cruise_stop
            while not stop.is_set():
                self.continuous_move(direction[0] * speed, 0)
                if stop.wait(8):
                    break
                self.stop()
                if stop.wait(0.5):
                    break
                direction[0] *= -1

        threading.Thread(target=_loop, daemon=True).start()

    def cruise_vertical(self, speed: float = 0.5):
        self._cruise_stop = threading.Event()
        direction = [1]

        def _loop():
            stop = self._cruise_stop
            while not stop.is_set():
                self.continuous_move(0, direction[0] * speed)
                if stop.wait(6):
                    break
                self.stop()
                if stop.wait(0.5):
                    break
                direction[0] *= -1

        threading.Thread(target=_loop, daemon=True).start()

    def stop_cruise(self):
        if self._cruise_stop:
            self._cruise_stop.set()
        self.stop()

    def start_patrol(self, preset_tokens: list[str], interval: int = 10):
        if not preset_tokens:
            return
        self.stop_patrol()
        self._patrol_stop = threading.Event()

        def _loop():
            stop = self._patrol_stop
            idx = 0
            while not stop.is_set():
                token = preset_tokens[idx % len(preset_tokens)]
                try:
                    self.goto_preset(token)
                except Exception:
                    pass
                if stop.wait(interval):
                    break
                idx += 1

        threading.Thread(target=_loop, daemon=True).start()

    def stop_patrol(self):
        if self._patrol_stop:
            self._patrol_stop.set()

    def disconnect(self):
        self.stop_patrol()
        self.stop_cruise()
        self._connected = False
        self._cam = None
        self._ptz = None
        self._media = None
        self._profile_token = None
        self._transport = None
        self._fast_transport = None
