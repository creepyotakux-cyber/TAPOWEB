import json
import logging
import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import HTTPException, Request, WebSocket, status
from jose import JWTError, jwt

from backend.config import DATA_DIR

logger = logging.getLogger("auth")

USERS_PATH = DATA_DIR / "users.json"
SECRET_PATH = DATA_DIR / ".secret_key"
ALGORITHM = "HS256"
TOKEN_EXPIRE_HOURS = 24


def _get_or_create_secret() -> str:
    if SECRET_PATH.exists():
        return SECRET_PATH.read_text(encoding="utf-8").strip()
    key = secrets.token_hex(32)
    SECRET_PATH.write_text(key, encoding="utf-8")
    return key


SECRET_KEY = _get_or_create_secret()

DEFAULT_USERS = [
    {
        "username": "baseadv",
        "password": "admin123",
        "role": "baseadv",
        "allowed_camera_ids": [],
    },
    {
        "username": "traileradv",
        "password": "trailer123",
        "role": "traileradv",
        "allowed_camera_ids": [],
    },
]


def _seed_users():
    if USERS_PATH.exists():
        return
    users = []
    for u in DEFAULT_USERS:
        pw_hash = bcrypt.hashpw(
            u["password"].encode("utf-8"), bcrypt.gensalt()
        ).decode("utf-8")
        users.append(
            {
                "username": u["username"],
                "password_hash": pw_hash,
                "role": u["role"],
                "allowed_camera_ids": u["allowed_camera_ids"],
            }
        )
    USERS_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(USERS_PATH, "w", encoding="utf-8") as f:
        json.dump({"users": users}, f, indent=2, ensure_ascii=False)
    logger.warning(
        "Seeded default users in %s. CHANGE PASSWORDS for production.",
        USERS_PATH,
    )


_seed_users()


def load_users() -> list[dict]:
    try:
        with open(USERS_PATH, "r", encoding="utf-8") as f:
            data = json.load(f)
        return data.get("users", [])
    except (json.JSONDecodeError, OSError):
        return []


def save_users(users: list[dict]) -> None:
    with open(USERS_PATH, "w", encoding="utf-8") as f:
        json.dump({"users": users}, f, indent=2, ensure_ascii=False)


def _find_user(username: str) -> dict | None:
    for u in load_users():
        if u.get("username") == username:
            return u
    return None


def verify_password(username: str, password: str) -> dict | None:
    user = _find_user(username)
    if user is None:
        return None
    if bcrypt.checkpw(
        password.encode("utf-8"), user["password_hash"].encode("utf-8")
    ):
        return {
            "username": user["username"],
            "role": user["role"],
            "allowed_camera_ids": user.get("allowed_camera_ids", []),
        }
    return None


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + timedelta(hours=TOKEN_EXPIRE_HOURS)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def decode_access_token(token: str) -> dict | None:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None


def get_token_from_request(request: Request) -> str | None:
    auth = request.headers.get("Authorization", "")
    if auth.startswith("Bearer "):
        return auth[7:]
    return None


def get_token_from_query_or_header(request: Request) -> str | None:
    token = request.query_params.get("token")
    if token:
        return token
    return get_token_from_request(request)


def get_token_from_ws(websocket: WebSocket) -> str | None:
    token = websocket.query_params.get("token")
    if token:
        return token
    return None


def _authenticate(token: str | None) -> dict:
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token requerido",
        )
    payload = decode_access_token(token)
    if payload is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token invalido o expirado",
        )
    user = _find_user(payload.get("sub", ""))
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Usuario no encontrado",
        )
    return {
        "username": user["username"],
        "role": user["role"],
        "allowed_camera_ids": user.get("allowed_camera_ids", []),
    }


def get_current_user_http(request: Request) -> dict:
    token = get_token_from_request(request)
    return _authenticate(token)


async def get_current_user_ws(websocket: WebSocket) -> dict | None:
    token = get_token_from_ws(websocket)
    if not token:
        return None
    payload = decode_access_token(token)
    if payload is None:
        return None
    user = _find_user(payload.get("sub", ""))
    if user is None:
        return None
    return {
        "username": user["username"],
        "role": user["role"],
        "allowed_camera_ids": user.get("allowed_camera_ids", []),
    }


def get_trailer_user(role: str) -> dict | None:
    if role == "traileradv":
        return None
    for u in load_users():
        if u.get("role") == "traileradv":
            return u
    return None


def update_trailer_cameras(camera_ids: list[str]) -> bool:
    users = load_users()
    updated = False
    for u in users:
        if u.get("role") == "traileradv":
            u["allowed_camera_ids"] = camera_ids
            updated = True
            break
    if updated:
        save_users(users)
    return updated
