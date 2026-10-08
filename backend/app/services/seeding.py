import logging
from uuid import uuid4

from app.auth import hash_password
from app.config import get_settings
from app.seed import DEMO_PASSWORD

logger = logging.getLogger("devdiagnose.db")

_COLLECTIONS = [
    "members",
    "projects",
    "bugs",
    "notifications",
    "recentActivity",
    "bug_assignments",
    "invites",
]


def seed_demo(store, seed_payload: dict) -> None:
    """Load the demo dataset into every empty collection."""
    demo_hash = hash_password(DEMO_PASSWORD)
    for coll in _COLLECTIONS:
        if store.backend.count(coll) == 0 and coll in seed_payload:
            for doc in seed_payload[coll]:
                if coll == "members" and not doc.get("passwordHash"):
                    # Demo members share the demo password; real members
                    # are only ever created by an invite acceptance.
                    doc = {**doc, "passwordHash": demo_hash}
                store.backend.insert(coll, doc)
    if store.backend.count("company") == 0:
        store.backend.insert("company", {"id": "company", **seed_payload["company"]})
    logger.info("Seeded the demo dataset (SEED_DEMO_DATA is on).")


def ensure_bootstrap_admin(store, seed_payload: dict) -> None:
    """Create the very first Admin when the workspace has no members.

    The only other route to a member account is an invitation, and issuing
    one requires an existing Admin - so without this a database with demo
    seeding off would be permanently unloggable.
    """
    if store.backend.count("members") > 0:
        return
    settings = get_settings()
    if not settings.bootstrap_admin_email or not settings.bootstrap_admin_password:
        logger.error(
            "No members exist and no BOOTSTRAP_ADMIN_EMAIL/BOOTSTRAP_ADMIN_PASSWORD "
            "is configured - nobody can sign in. Set them and restart, or enable "
            "SEED_DEMO_DATA for a local demo."
        )
        return
    email = settings.bootstrap_admin_email.strip().lower()
    doc = {
        "id": "u1",
        "name": settings.bootstrap_admin_name.strip() or "Admin",
        "firstName": settings.bootstrap_admin_name.strip().split(" ")[0],
        "lastName": " ".join(settings.bootstrap_admin_name.strip().split(" ")[1:]),
        "email": email,
        "role": "Admin",
        "avatarColor": "#6366f1",
        "status": "Active",
        "assignedBugs": 0,
        "resolvedBugs": 0,
        "lastActive": "just now",
        "passwordHash": hash_password(settings.bootstrap_admin_password),
        "inviteTokenHash": None,
        "inviteSentAt": None,
        "inviteExpiresAt": None,
        "protected": True,
    }
    store.backend.insert("members", doc)
    if store.backend.count("company") == 0 and "company" in seed_payload:
        store.backend.insert("company", {"id": "company", **seed_payload["company"]})
    logger.info("Created the bootstrap Admin account %s", email)


def migrate(store, fallback_user_id: str) -> None:
    """Normalize pre-existing documents to the current schema in place."""
    fallback = fallback_user_id

    for member in store.backend.find_all("members"):
        changed = False
        # A missing hash is left as-is on purpose: accounts without one
        # cannot sign in, and overwriting them with a shared password would
        # be a far worse outcome than requiring an admin to re-invite.
        if not member.get("status"):
            member["status"] = "Active"
            changed = True
        if changed:
            store.backend.replace("members", member)

    for bug in store.backend.find_all("bugs"):
        changed = False
        if bug.get("status") == "Resolved" and not bug.get("resolvedAt"):
            bug["resolvedBy"] = bug.get("resolvedBy") or bug.get("reporterId") or fallback
            bug["resolvedAt"] = bug.get("updatedAt") or bug.get("createdAt") or "imported"
            changed = True
        if bug.get("status") == "Closed":
            # Only write when a field is actually missing, otherwise every
            # Closed bug is rewritten on every cold start.
            if not bug.get("closedAt"):
                bug["closedAt"] = bug.get("updatedAt") or bug.get("createdAt") or "imported"
                changed = True
            if not bug.get("resolvedAt"):
                bug["resolvedBy"] = bug.get("resolvedBy") or bug.get("reporterId") or fallback
                bug["resolvedAt"] = bug.get("updatedAt") or bug.get("createdAt") or "imported"
                changed = True
        for ev in bug.get("evidence", []):
            if isinstance(ev, dict):
                if "fileUrl" not in ev:
                    ev["fileUrl"] = None
                    changed = True
                if "metadata" not in ev:
                    ev["metadata"] = {}
                    changed = True
        for an in bug.get("analyses", []):
            if not isinstance(an, dict):
                continue
            fix = an.get("suggestedFix")
            if isinstance(fix, str):
                an["suggestedFix"] = {"summary": fix, "steps": [], "code": None}
                changed = True
            if isinstance(an.get("uncertainty"), list):
                an["uncertainty"] = (
                    " ".join(str(u) for u in an["uncertainty"]) if an["uncertainty"] else None
                )
                changed = True
            if "inputContext" not in an:
                an["inputContext"] = {}
                changed = True
        if changed:
            store.backend.replace("bugs", bug)

    if store.backend.count("bug_assignments") == 0:
        for bug in store.backend.find_all("bugs"):
            for dev_id in bug.get("assigneeIds", []):
                store.backend.insert(
                    "bug_assignments",
                    {
                        "id": f"ba{uuid4().hex[:8]}",
                        "bugId": bug["id"],
                        "developerId": dev_id,
                        "assignedBy": bug.get("reporterId") or fallback,
                        "assignedAt": bug.get("createdAt", "imported"),
                        "unassignedAt": None,
                        "status": "active",
                    },
                )
