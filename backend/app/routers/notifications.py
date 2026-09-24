from fastapi import APIRouter, Depends

from app.db import get_store
from app.deps import get_current_user

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _visible(note: dict, user_id: str) -> bool:
    """Broadcast notes (no userIds) are visible to everyone; targeted notes only to their audience."""
    ids = note.get("userIds")
    return not ids or user_id in ids


@router.get("")
def list_notifications(user: dict = Depends(get_current_user)) -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    return [n for n in store.find_all("notifications") if _visible(n, user["id"])]


@router.post("/read-all")
def mark_all_read(user: dict = Depends(get_current_user)) -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    visible = []
    for note in store.find_all("notifications"):
        if not _visible(note, user["id"]):
            continue
        if not note.get("read"):
            note["read"] = True
            store.replace("notifications", note)
        visible.append(note)
    return visible