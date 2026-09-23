from fastapi import APIRouter

from app.db import get_store, public_user

router = APIRouter(prefix="/members", tags=["members"])


@router.get("")
def list_members() -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    return [public_user(m) for m in store.find_all("members")]