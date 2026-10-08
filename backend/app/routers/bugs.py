import time

from fastapi import APIRouter, Depends, HTTPException

from app.config import get_settings
from app.db import get_store
from app.deps import get_current_user
from app.schemas import (
    BugCreate,
    BugPatch,
    CommentIn,
    StatusUpdate,
)
from app.services.bug_workflow import (
    append_comment,
    apply_bug_patch,
    create_bug_document,
    load_visible_bug,
    record_analysis,
)
from app.services.groq import GroqAnalyzerError, run_analysis
from app.status_rules import visible_bugs
from app.types import Bug

router = APIRouter(prefix="/bugs", tags=["bugs"])

# Used when a bug references a project that has since been deleted.
_UNKNOWN_PROJECT = {
    "name": "Unknown",
    "purpose": "",
    "modules": [],
    "backend": [],
    "frontend": [],
    "constraints": "",
    "businessRules": [],
}


@router.get("")
def list_bugs(user: dict = Depends(get_current_user)) -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    projects = store.find_all("projects")
    return visible_bugs(user, store.find_all("bugs"), projects)


@router.get("/{bug_id}")
def get_bug(bug_id: str, user: dict = Depends(get_current_user)) -> dict:
    store = get_store()
    store.seed_if_empty()
    bug = load_visible_bug(store, bug_id, user)
    return Bug.model_validate(bug).model_dump(mode="json")


@router.post("", status_code=201)
def create_bug(payload: BugCreate, user: dict = Depends(get_current_user)) -> dict:
    store = get_store()
    store.seed_if_empty()
    return create_bug_document(store, payload, user)


@router.patch("/{bug_id}")
def patch_bug(bug_id: str, payload: BugPatch, user: dict = Depends(get_current_user)) -> dict:
    store = get_store()
    store.seed_if_empty()
    bug = load_visible_bug(store, bug_id, user)
    return apply_bug_patch(store, bug, payload, user)


@router.patch("/{bug_id}/status")
def set_status(bug_id: str, payload: StatusUpdate, user: dict = Depends(get_current_user)) -> dict:
    return patch_bug(bug_id, BugPatch(status=payload.status), user)


@router.post("/{bug_id}/comments")
def add_comment(
    bug_id: str,
    payload: CommentIn,
    user: dict = Depends(get_current_user),
) -> dict:
    store = get_store()
    store.seed_if_empty()
    bug = load_visible_bug(store, bug_id, user)
    return append_comment(store, bug, payload, user)


# Per-process cooldown for the AI endpoint. Enough to stop a double-click loop
# from repeatedly billing Groq and appending a full context snapshot.
_LAST_ANALYSIS: dict[tuple[str, str], float] = {}


def _check_analyze_cooldown(user_id: str, bug_id: str) -> None:
    cooldown = get_settings().analyze_cooldown_seconds
    if cooldown <= 0:
        return
    key = (user_id, bug_id)
    now = time.monotonic()
    previous = _LAST_ANALYSIS.get(key)
    if previous is not None and now - previous < cooldown:
        wait = int(cooldown - (now - previous)) + 1
        raise HTTPException(
            status_code=429,
            detail=f"Analysis already ran for this bug. Try again in {wait}s.",
        )
    _LAST_ANALYSIS[key] = now


@router.post("/{bug_id}/analyze")
def analyze_bug(bug_id: str, user: dict = Depends(get_current_user)) -> dict:
    store = get_store()
    store.seed_if_empty()
    bug = load_visible_bug(store, bug_id, user)
    _check_analyze_cooldown(user["id"], bug_id)

    project = store.find_one("projects", bug.get("projectId", "")) or dict(_UNKNOWN_PROJECT)

    try:
        raw = run_analysis(bug, project)
    except GroqAnalyzerError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    cleaned, analysis = record_analysis(store, bug, project, raw)
    return {"bug": cleaned, "analysis": analysis}
