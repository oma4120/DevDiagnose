from fastapi import APIRouter, Depends

from app.db import get_store, public_user
from app.deps import get_current_user

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