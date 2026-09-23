"""Public invitation endpoints: validate an invite link and accept it.

An invitation is a pending `invites` record (no member exists yet). The
employee follows the emailed link, sets their name + password, and the member
is created here — then they are redirected to the login page.
"""

from fastapi import APIRouter, HTTPException, status

from app.auth import hash_password
from app.db import get_store
from app.invites import find_invite_by_token, invite_status_of, now_iso
from app.schemas import InviteAccept, allocate_id

router = APIRouter(prefix="/invites", tags=["invites"])

_AVATAR_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"]


def _avatar_for(email: str) -> str:
    return _AVATAR_COLORS[sum(email.encode("utf-8")) % len(_AVATAR_COLORS)]


@router.get("/{token}")
def invite_status(token: str) -> dict:
    store = get_store()
    store.seed_if_empty()
    invite = find_invite_by_token(store, token)
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    ok, reason = invite_status_of(invite)
    if not ok:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=reason)
    return {
        "valid": True,
        "email": invite["email"],
        "expiresAt": invite.get("expiresAt"),
        "name": "",
    }


@router.post("/accept")
def accept_invite(payload: InviteAccept) -> dict:
    store = get_store()
    store.seed_if_empty()
    invite = find_invite_by_token(store, payload.token)
    if invite is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Invitation not found")
    ok, reason = invite_status_of(invite)
    if not ok:
        raise HTTPException(status_code=status.HTTP_410_GONE, detail=reason)

    email = invite["email"]
    if store.find_one_by("members", "email", email):
        store.replace("invites", {**invite, "status": "used", "acceptedAt": now_iso()})
        raise HTTPException(status_code=status.HTTP_410_GONE, detail="An account for this email already exists")

    first = payload.firstName.strip()
    last = payload.lastName.strip()
    existing = store.find_all("members")
    doc = {
        "id": allocate_id("u", [m["id"] for m in existing]),
        "name": f"{first} {last}".strip(),
        "firstName": first,
        "lastName": last,
        "email": email,
        "role": invite.get("role", "Developer"),
        "avatarColor": _avatar_for(email),
        "status": "Active",
        "assignedBugs": 0,
        "resolvedBugs": 0,
        "lastActive": "just now",
        "passwordHash": hash_password(payload.password),
        "inviteTokenHash": None,
        "inviteSentAt": None,
        "inviteExpiresAt": None,
    }
    store.insert("members", doc)
    store.replace("invites", {**invite, "status": "accepted", "acceptedAt": now_iso(), "memberId": doc["id"]})

    return {"accepted": True, "email": email}