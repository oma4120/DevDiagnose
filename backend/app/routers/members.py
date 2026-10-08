from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_store, public_user
from app.deps import get_current_user
from app.invites import build_invite_url, new_invite_doc
from app.mail import send_invite_email
from app.schemas import MemberCreate

router = APIRouter(prefix="/members", tags=["members"])


def _now_label() -> str:
    return datetime.now().strftime("%b %d, %Y · %H:%M")


def _require_admin(user: dict) -> None:
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Admins can manage members")


@router.get("")
def list_members(user: dict = Depends(get_current_user)) -> list[dict]:
    """Admin-only: the full roster, including the `protected` flag.

    Everyone else gets the directory they need through /api/bootstrap, which is
    scoped to the projects they belong to.
    """
    _require_admin(user)
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
    # Greet the invitee by the name the admin typed, not a generic "there".
    display_name = " ".join(p for p in (payload.firstName.strip(), payload.lastName.strip()) if p)
    email_sent = send_invite_email(email, name=display_name or "there", invite_url=invite_url)

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

    # Scrub every remaining reference, otherwise bugs keep pointing at a member
    # that no longer exists: the board renders an undefined assignee, assignment
    # history stays "active" forever, and targeted notifications address a
    # deleted account.
    for bug in store.find_all("bugs"):
        changed = False
        if bug.get("reporterId") == member_id:
            bug["reporterId"] = "u1"
            changed = True
        if member_id in (bug.get("assigneeIds") or []):
            bug["assigneeIds"] = [m for m in bug["assigneeIds"] if m != member_id]
            changed = True
        for key in ("resolvedBy", "validatorId"):
            if bug.get(key) == member_id:
                bug[key] = None
                changed = True
        if changed:
            store.replace("bugs", bug)

    for assignment in store.find_all("bug_assignments"):
        if assignment.get("developerId") == member_id and assignment.get("status") == "active":
            assignment["status"] = "removed"
            assignment["unassignedAt"] = _now_label()
            store.replace("bug_assignments", assignment)

    for note in store.find_all("notifications"):
        if member_id in (note.get("userIds") or []):
            note["userIds"] = [m for m in note["userIds"] if m != member_id]
            store.replace("notifications", note)

    for invite in store.find_all("invites"):
        if invite.get("memberId") == member_id:
            store.delete_one("invites", invite["id"])

    return {"deleted": True, "id": member_id}