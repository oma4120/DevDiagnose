"""Invitation token helpers for the invite-by-email flow.

An invite is a standalone pending record in the `invites` collection. The
member document is only created when the invite is accepted (the employee sets
their name + password on the invite link). Only a SHA-256 digest of the raw
token is stored, so a DB leak cannot be used to accept invitations.
"""

import hashlib
import secrets
from datetime import datetime, timedelta, timezone

from app.config import get_settings


def new_invite_token() -> str:
    return secrets.token_urlsafe(32)


def hash_invite_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def expires_at_iso() -> str:
    settings = get_settings()
    return (datetime.now(timezone.utc) + timedelta(hours=settings.invite_ttl_hours)).isoformat()


def build_invite_url(token: str) -> str:
    settings = get_settings()
    return f"{settings.app_url.rstrip('/')}/invite/{token}"


def new_invite_doc(store, email: str, role: str, firstName: str = "", lastName: str = "") -> tuple[dict, str]:
    """Insert a pending invitation and return (invite_doc, raw_token)."""
    token = new_invite_token()
    existing = store.find_all("invites")
    doc = {
        "id": _allocate_invite_id(existing),
        "tokenHash": hash_invite_token(token),
        "email": email,
        "role": role,
        "firstName": firstName.strip(),
        "lastName": lastName.strip(),
        "status": "pending",
        "createdAt": now_iso(),
        "expiresAt": expires_at_iso(),
    }
    store.insert("invites", doc)
    return doc, token


def _allocate_invite_id(existing: list[dict]) -> str:
    used = {inv.get("id", "") for inv in existing}
    n = 1
    while f"inv{n}" in used:
        n += 1
    return f"inv{n}"


def find_invite_by_token(store, token: str) -> dict | None:
    return store.find_one_by("invites", "tokenHash", hash_invite_token(token))


def invite_status_of(invite: dict) -> tuple[bool, str]:
    """Return (ok, reason) for validating an invitation link."""
    if invite.get("status") != "pending":
        return False, "Invitation already used or no longer pending."
    raw_expiry = invite.get("expiresAt")
    try:
        expiry = datetime.fromisoformat(raw_expiry) if raw_expiry else None
    except (TypeError, ValueError):
        expiry = None
    if expiry is None:
        return False, "Invitation is missing an expiry; ask an admin to re-invite you."
    if expiry < datetime.now(timezone.utc):
        return False, "Invitation link has expired; ask an admin to re-invite you."
    return True, ""