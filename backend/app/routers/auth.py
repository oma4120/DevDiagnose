"""Public auth endpoints: login + change-password."""

from fastapi import APIRouter, Depends, HTTPException, status

from app.auth import create_token, hash_password, verify_password
from app.db import get_store, public_user
from app.deps import get_current_user
from app.schemas import AuthRequest, PasswordChange

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


@router.post("/change-password")
def change_password(
    payload: PasswordChange,
    user: dict = Depends(get_current_user),
) -> dict:
    """Signed-in user replaces their own password (Settings > Profile)."""
    store = get_store()
    store.seed_if_empty()
    member = store.find_one("members", user.get("id", ""))
    if member is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    if not verify_password(payload.currentPassword, member.get("passwordHash")):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Current password is incorrect",
        )
    member["passwordHash"] = hash_password(payload.newPassword)
    store.replace("members", member)
    return {"ok": True}
