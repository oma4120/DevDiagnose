"""Public auth endpoints: POST /api/auth/login."""

from fastapi import APIRouter, HTTPException, status

from app.auth import create_token, verify_password
from app.db import get_store, public_user
from app.schemas import AuthRequest

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
def login(payload: AuthRequest) -> dict:
    store = get_store()
    store.seed_if_empty()
    member = store.find_one_by("members", "email", payload.email.strip())
    if member is None or not verify_password(payload.password.strip(), member.get("passwordHash")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    token = create_token(member["id"])
    return {"token": token, "user": public_user(member)}