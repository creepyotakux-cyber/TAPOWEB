from pydantic import BaseModel


class CameraCreate(BaseModel):
    name: str = ""
    ip: str = ""
    user: str = ""
    password: str = ""
    cloud_password: str = ""
    model: str = ""
    enabled: bool = True


class CameraUpdate(BaseModel):
    name: str | None = None
    ip: str | None = None
    user: str | None = None
    password: str | None = None
    cloud_password: str | None = None
    model: str | None = None
    enabled: bool | None = None


class ReorderRequest(BaseModel):
    from_index: int
    to_index: int


class PTZCommand(BaseModel):
    action: str
    pan: float = 0.0
    tilt: float = 0.0
    speed: float = 0.5
    preset_token: str = ""
    preset_name: str = ""
    interval: int = 10


class StreamStatus(BaseModel):
    camera_id: int
    active: bool
    pid: int | None = None
