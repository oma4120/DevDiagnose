"""Public auth endpoints: login + change-password."""

from fastapi import APIRouter, Depends, HTTPException, Response, status

from app.auth import AUTH_COOKIE_NAME, create_token, hash_password, verify_password
from app.config import get_settings
from app.db import get_store, public_user
from app.deps import get_current_user
from app.schemas import AuthRequest, PasswordChange

router = APIRouter(prefix="/auth", tags=["auth"])

# Cookie is HttpOnly, Secure, SameSite=Lax; max age 7 days to match token lifetime.
COOKIE_MAX_AGE = 60 * 60 * 24 * 7


@router.post("/login")
def login(payload: AuthRequest, response: Response) -> dict:
    store = get_store()
    store.seed_if_empty()
    member = store.find_one_by("members", "email", payload.email.strip())
    if member is None or not verify_password(payload.password.strip(), member.get("passwordHash")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password",
        )
    if (member.get("status") or "Active") != "Active":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This account is not active. Ask an admin to re-send your invitation.",
        )
    token = create_token(member["id"])
    # Secure only when the app is served over https; a Secure cookie would be
    # dropped entirely over plain http (e.g. the local dev proxy on :5173).
    secure = get_settings().app_url.lower().startswith("https://")
    response.set_cookie(
        key=AUTH_COOKIE_NAME,
        value=token,
        httponly=True,
        secure=secure,
        samesite="lax",
        max_age=COOKIE_MAX_AGE,
        path="/",
    )
    # The JWT is only delivered in the HttpOnly cookie; never in the body,
    # where page JavaScript could read it.
    return {"user": public_user(member)}


@router.post("/logout")
def logout(response: Response) -> dict:
    response.delete_cookie(key=AUTH_COOKIE_NAME, path="/")
    return {"ok": True}


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
