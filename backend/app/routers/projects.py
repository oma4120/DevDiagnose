from fastapi import APIRouter, Depends, HTTPException

from app.db import get_store
from app.deps import get_current_user
from app.schemas import ProjectCreate, ProjectMemberAdd, ProjectPatch, allocate_id
from app.status_rules import visible_projects
from app.types import Project

router = APIRouter(prefix="/projects", tags=["projects"])


def _require_admin(user: dict) -> None:
    if user.get("role") != "Admin":
        raise HTTPException(status_code=403, detail="Only admins can manage projects")


@router.get("")
def list_projects(user: dict = Depends(get_current_user)) -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    return visible_projects(user, store.find_all("projects"))


@router.get("/{project_id}")
def get_project(project_id: str, user: dict = Depends(get_current_user)) -> dict:
    store = get_store()
    store.seed_if_empty()
    project = store.find_one("projects", project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    # Non-admins only reach the projects they are a member of; a project they
    # cannot see is reported as missing rather than forbidden, so the API does
    # not confirm that an id exists.
    if project_id not in {p["id"] for p in visible_projects(user, [project])}:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project


@router.post("/{project_id}/members")
def add_project_member(
    project_id: str,
    payload: ProjectMemberAdd,
    user: dict = Depends(get_current_user),
) -> dict:
    """Admin-only: give a registered employee access to this project."""
    _require_admin(user)
    store = get_store()
    store.seed_if_empty()
    project = store.find_one("projects", project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    member = store.find_one("members", payload.memberId)
    if not member:
        raise HTTPException(status_code=404, detail=f"Member {payload.memberId} not found")
    member_ids = project.get("memberIds") or []
    if payload.memberId in member_ids:
        raise HTTPException(
            status_code=409,
            detail=f"{member.get('name') or member.get('email')} is already on this project",
        )
    project["memberIds"] = [*member_ids, payload.memberId]
    project["updatedAt"] = "just now"
    store.replace("projects", project)
    return project


@router.post("", status_code=201)
def create_project(
    payload: ProjectCreate,
    user: dict = Depends(get_current_user),
) -> dict:
    """Admin-only: projects are workspace configuration and gate bug visibility."""
    _require_admin(user)
    store = get_store()
    store.seed_if_empty()
    known_members = {m["id"] for m in store.find_all("members")}
    unknown = [mid for mid in payload.memberIds if mid not in known_members]
    if unknown:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown team members: {', '.join(unknown)}",
        )
    existing = store.find_all("projects")
    doc = Project.model_validate(
        {
            **payload.model_dump(mode="json"),
            "id": allocate_id("p", [p["id"] for p in existing]),
            "openBugs": 0,
            "highSeverity": 0,
            "resolvedBugs": 0,
            "awaitingValidation": 0,
            "updatedAt": "just now",
        }
    ).model_dump(mode="json")
    store.insert("projects", doc)
    return doc


@router.patch("/{project_id}")
def update_project(
    project_id: str,
    payload: ProjectPatch,
    user: dict = Depends(get_current_user),
) -> dict:
    """Admin-only: edit project configuration (the AI knowledge base)."""
    _require_admin(user)
    store = get_store()
    store.seed_if_empty()
    project = store.find_one("projects", project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    updates = payload.model_dump(exclude_none=True)
    if "memberIds" in updates:
        known = {m["id"] for m in store.find_all("members")}
        unknown = [mid for mid in updates["memberIds"] if mid not in known]
        if unknown:
            raise HTTPException(
                status_code=400,
                detail=f"Unknown team members: {', '.join(unknown)}",
            )

    project.update(updates)
    project["updatedAt"] = "just now"
    store.replace("projects", project)
    return project