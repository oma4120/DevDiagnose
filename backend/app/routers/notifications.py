from fastapi import APIRouter, Depends

from app.db import get_store
from app.deps import get_current_user
from app.status_rules import visible_bugs, visible_notifications

router = APIRouter(prefix="/notifications", tags=["notifications"])


def _visible_notes(store, user: dict) -> list[dict]:
    """Notes the user may see, by audience and by bug visibility."""
    projects = store.find_all("projects")
    bugs = visible_bugs(user, store.find_all("bugs"), projects)
    return visible_notifications(user, store.find_all("notifications"), bugs)


@router.get("")
def list_notifications(user: dict = Depends(get_current_user)) -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    # A broadcast note used to reach every signed-in user, so a note about
    # "Bug #1032 was assigned to Rami" was readable outside that team.
    return _visible_notes(store, user)


@router.post("/read-all")
def mark_all_read(user: dict = Depends(get_current_user)) -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    visible = []
    for note in _visible_notes(store, user):
        if not note.get("read"):
            note["read"] = True
            store.replace("notifications", note)
        visible.append(note)
    return visible