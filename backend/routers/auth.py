from fastapi import APIRouter, HTTPException, Depends, Request

from backend.auth import (
    verify_password,
    create_access_token,
    get_current_user_http,
    get_trailer_user,
    update_trailer_cameras,
    TOKEN_EXPIRE_HOURS,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post("/login")
def login(body: dict):
    username = (body.get("username") or "").strip()
    password = (body.get("password") or "")
    if not username or not password:
        raise HTTPException(status_code=400, detail="Usuario y contrasena requeridos")
    user = verify_password(username, password)
    if user is None:
        raise HTTPException(status_code=401, detail="Credenciales invalidas")
    token = create_access_token({"sub": user["username"], "role": user["role"]})
    return {
        "access_token": token,
        "token_type": "bearer",
        "expires_in": TOKEN_EXPIRE_HOURS * 3600,
        "user": user,
    }


@router.get("/me")
def me(request: Request):
    user = get_current_user_http(request)
    return user


@router.get("/trailer-cameras")
def get_trailer_cameras(request: Request):
    current = get_current_user_http(request)
    if current["role"] != "baseadv":
        raise HTTPException(status_code=403, detail="Solo el administrador puede ver esto")
    trailer = get_trailer_user(current["role"])
    if trailer is None:
        return {"allowed_camera_ids": []}
    return {"allowed_camera_ids": trailer.get("allowed_camera_ids", [])}


@router.put("/trailer-cameras")
def set_trailer_cameras(body: dict, request: Request):
    current = get_current_user_http(request)
    if current["role"] != "baseadv":
        raise HTTPException(status_code=403, detail="Solo el administrador puede configurar esto")
    camera_ids = body.get("allowed_camera_ids", [])
    if not isinstance(camera_ids, list):
        raise HTTPException(status_code=400, detail="allowed_camera_ids debe ser una lista")
    update_trailer_cameras(camera_ids)
    return {"success": True, "allowed_camera_ids": camera_ids}
