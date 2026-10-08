import re

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_store, public_user
from app.deps import get_current_user
from app.schemas import CompanyUpdate
from app.status_rules import (
    sees_all_projects,
    visible_activity,
    visible_bugs,
    visible_notifications,
    visible_projects,
)

router = APIRouter(tags=["meta"])

private = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> dict:
    store = get_store()
    return {"status": "ok", "backend": "mongo", "seeded": store.seeded}


def _visible_members(user: dict, members: list[dict], projects: list[dict], bugs: list[dict]) -> list[dict]:
    """Enough of the directory to render names, without exposing the whole roster.

    Admin and QA get everyone. Everyone else gets themselves plus the people on
    their visible projects and the people attached to bugs they can read, which
    covers assignee avatars and the reporter/assignee lookups on a bug page.
    """
    if sees_all_projects(user.get("role", "")):
        return members
    keep = {user.get("id")}
    for project in projects:
        keep.update(project.get("memberIds") or [])
    for bug in bugs:
        keep.add(bug.get("reporterId"))
        keep.update(bug.get("assigneeIds") or [])
    keep.discard(None)
    return [m for m in members if m["id"] in keep]


@private.get("/bootstrap")
def bootstrap(user: dict = Depends(get_current_user)) -> dict:
    store = get_store()
    store.seed_if_empty()
    member = store.find_one("members", user["id"])
    if not member:
        raise HTTPException(status_code=401, detail="User not found")

    all_projects = store.find_all("projects")
    projects = visible_projects(user, all_projects)
    bugs = visible_bugs(user, store.find_all("bugs"), all_projects)

    return {
        "currentUser": public_user(member),
        "company": store.company(),
        "members": [public_user(m) for m in _visible_members(user, store.find_all("members"), projects, bugs)],
        "projects": projects,
        "bugs": bugs,
        # Both feeds used to be returned whole, which leaked bug titles, reporter
        # names and company activity to members who cannot see those bugs.
        "notifications": visible_notifications(user, store.find_all("notifications"), bugs),
        "recentActivity": visible_activity(user, store.find_all("recentActivity")),
    }


@private.patch("/company")
def update_company(
    payload: CompanyUpdate,
    user: dict = Depends(get_current_user),
) -> dict:
    if user.get("role") != "Admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admins can manage company settings")
    store = get_store()
    store.seed_if_empty()

    updates: dict = {}
    if payload.name is not None:
        updates["name"] = payload.name
    if payload.workspace is not None:
        ws = payload.workspace
        if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", ws):
            raise HTTPException(
                status_code=422,
                detail="Workspace can only use lowercase letters, numbers and hyphens (e.g. northwind)",
            )
        updates["workspace"] = ws
    if payload.hasQA is not None:
        updates["hasQA"] = payload.hasQA
    if payload.logo is not None:
        updates["logo"] = payload.logo or None
    if not updates:
        raise HTTPException(status_code=422, detail="No fields to update")
    return store.save_company(updates)