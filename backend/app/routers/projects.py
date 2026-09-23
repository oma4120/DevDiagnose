from fastapi import APIRouter, HTTPException

from app.db import get_store
from app.schemas import ProjectCreate, allocate_id
from app.types import Project

router = APIRouter(prefix="/projects", tags=["projects"])


@router.get("")
def list_projects() -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    return store.find_all("projects")


@router.get("/{project_id}")
def get_project(project_id: str) -> dict:
    store = get_store()
    store.seed_if_empty()
    project = store.find_one("projects", project_id)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")
    return project


@router.post("", status_code=201)
def create_project(payload: ProjectCreate) -> dict:
    store = get_store()
    store.seed_if_empty()
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