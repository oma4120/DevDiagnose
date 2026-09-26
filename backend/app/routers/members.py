from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_store, public_user
from app.deps import get_current_user
from app.invites import build_invite_url, new_invite_doc
from app.mail import send_invite_email
from app.schemas import MemberCreate

router = APIRouter(prefix="/members", tags=["members"])

_AVATAR_COLORS = ["#6366f1", "#06b6d4", "#f59e0b", "#10b981", "#3b82f6", "#ef4444"]


def _require_admin(user: dict) -> None:
    if user.get("role") != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins can manage members")


def _avatar_for(email: str) -> str:
    return _AVATAR_COLORS[sum(email.encode("utf-8")) % len(_AVATAR_COLORS)]


@router.get("")
def list_members() -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    return [public_user(m) for m in store.find_all("members")]


@router.post("", status_code=201)
def invite_by_email(
    payload: MemberCreate,
    user: dict = Depends(get_current_user),
) -> dict:
    """Send an invitation email without creating the member yet. The member
    document is created when the employee completes their profile via the link."""
    store = get_store()
    store.seed_if_empty()
    _require_admin(user)

    email = payload.email.strip().lower()
    if store.find_one_by("members", "email", email):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"{email} is already a member")
    if any(i.get("email", "").lower() == email and i.get("status") == "pending" for i in store.find_all("invites")):
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=f"{email} already has a pending invitation")

    invite, token = new_invite_doc(store, email, str(payload.role), payload.firstName, payload.lastName)
    invite_url = build_invite_url(token)
    email_sent = send_invite_email(email, invite_url=invite_url)

    return {
        "email": email,
        "inviteLink": invite_url,
        "expiresAt": invite["expiresAt"],
        "emailSent": email_sent,
    }


@router.delete("/{member_id}")
def delete_member(member_id: str, user: dict = Depends(get_current_user)) -> dict:
    """Admin-only. Members marked `protected` (the default admin) cannot be deleted."""
    store = get_store()
    store.seed_if_empty()
    _require_admin(user)

    member = store.find_one("members", member_id)
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    if member.get("protected"):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="This admin is protected and can't be deleted",
        )

    store.delete_one("members", member_id)
    for project in store.find_all("projects"):
        member_ids = project.get("memberIds") or []
        if member_id in member_ids:
            project["memberIds"] = [m for m in member_ids if m != member_id]
            store.replace("projects", project)
    return {"deleted": True, "id": member_id}