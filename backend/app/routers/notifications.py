from fastapi import APIRouter

from app.db import get_store

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("")
def list_notifications() -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    return store.find_all("notifications")


@router.post("/read-all")
def mark_all_read() -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    return store.mark_all_read()