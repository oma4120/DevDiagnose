import re

from fastapi import APIRouter, Depends, HTTPException, status

from app.db import get_store, public_user
from app.deps import get_current_user
from app.schemas import CompanyUpdate

router = APIRouter(tags=["meta"])

private = APIRouter(tags=["meta"])


@router.get("/health")
def health() -> dict:
    store = get_store()
    backend = "mongo" if store.backend.__class__.__name__ == "MongoStore" else "memory"
    return {"status": "ok", "backend": backend, "seeded": store.seeded}


@private.get("/bootstrap")
def bootstrap(user: dict = Depends(get_current_user)) -> dict:
    store = get_store()
    store.seed_if_empty()
    member = store.find_one("members", user["id"])
    current_user = public_user(member) if member else public_user(store.current_user())
    return {
        "currentUser": current_user,
        "company": store.company(),
        "members": [public_user(m) for m in store.find_all("members")],
        "projects": store.find_all("projects"),
        "bugs": store.find_all("bugs"),
        "notifications": store.find_all("notifications"),
        "recentActivity": store.find_all("recentActivity"),
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