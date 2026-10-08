"""Shared FastAPI dependencies."""

from fastapi import Cookie, HTTPException, status

from app.auth import AUTH_COOKIE_NAME, decode_token
from app.db import get_store, public_user


def get_current_user(token: str | None = Cookie(default=None, alias=AUTH_COOKIE_NAME)) -> dict:
    if not token or not token.strip():
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Missing credentials")

    token = token.strip()
    user_id = decode_token(token)
    if not user_id:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "Invalid or expired token")

    store = get_store()
    user = store.find_one("members", user_id)
    if not user:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "User not found")
    return public_user(user)
