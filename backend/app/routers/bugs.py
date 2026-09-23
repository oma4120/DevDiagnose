from datetime import datetime
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException

from app.db import get_store
from app.deps import get_current_user
from app.schemas import (
    BugCreate,
    BugPatch,
    CommentIn,
    StatusUpdate,
    allocate_id,
    build_analysis_doc,
    build_evidence_doc,
)
from app.seed import current_bug_ref
from app.services.groq import GroqAnalyzerError, run_analysis
from app.types import Bug, TimelineEntry

router = APIRouter(prefix="/bugs", tags=["bugs"])


def _now() -> str:
    return datetime.now().strftime("%b %d, %Y · %H:%M")


def _member_names() -> dict[str, str]:
    store = get_store()
    return {m["id"]: m["name"] for m in store.find_all("members")}


def _new_id(prefix: str, docs: list[dict]) -> str:
    return allocate_id(prefix, [d["id"] for d in docs if d.get("id", "").startswith(prefix)])


def _sync_assignments(
    bug: dict,
    new_assignee_ids: list[str],
    actor: dict,
    now: str,
    previous_ids: list[str] | None = None,
) -> None:
    """Reconcile bug_assignments records so they mirror bug.assigneeIds."""
    store = get_store()
    names = _member_names()
    old_ids = previous_ids if previous_ids is not None else list(bug.get("assigneeIds", []))

    for doc in store.find_all("bug_assignments"):
        if (
            doc.get("bugId") == bug["id"]
            and doc.get("status") == "active"
            and doc.get("developerId") not in new_assignee_ids
        ):
            doc["unassignedAt"] = now
            doc["status"] = "removed"
            store.replace("bug_assignments", doc)

    for dev_id in new_assignee_ids:
        if dev_id in old_ids:
            continue
        store.insert(
            "bug_assignments",
            {
                "id": f"ba{uuid4().hex[:8]}",
                "bugId": bug["id"],
                "developerId": dev_id,
                "assignedBy": actor.get("id", actor.get("name", "system")),
                "assignedAt": now,
                "unassignedAt": None,
                "status": "active",
            },
        )
        _push_notification(
            "Assignment",
            f"Bug {bug['ref']} was assigned to {names.get(dev_id, dev_id)}.",
            bug["ref"],
        )


def _push_notification(category: str, message: str, bug_ref: str | None = None) -> dict:
    store = get_store()
    docs = store.find_all("notifications")
    note = {
        "id": _new_id("n", docs),
        "category": category,
        "message": message,
        "at": "just now",
        "read": False,
        "bugRef": bug_ref,
    }
    store.insert("notifications", note)
    return note


def _bump_project(bug: dict, field: str, delta: int) -> None:
    store = get_store()
    project = store.find_one("projects", bug["projectId"])
    if not project:
        return
    project[field] = int(project.get(field, 0)) + delta
    store.replace("projects", project)


@router.get("")
def list_bugs() -> list[dict]:
    store = get_store()
    store.seed_if_empty()
    return store.find_all("bugs")


@router.get("/{bug_id}")
def get_bug(bug_id: str) -> dict:
    store = get_store()
    store.seed_if_empty()
    bug = store.find_one("bugs", bug_id)
    if not bug:
        raise HTTPException(status_code=404, detail=f"Bug {bug_id} not found")
    return Bug.model_validate(bug).model_dump(mode="json")


@router.post("", status_code=201)
def create_bug(payload: BugCreate, user: dict = Depends(get_current_user)) -> dict:
    store = get_store()
    store.seed_if_empty()
    bugs = store.find_all("bugs")
    bug_id, ref = current_bug_ref(bugs)
    names = _member_names()
    reporter = user if payload.reporterId == user.get("id") else {"id": payload.reporterId, "name": names.get(payload.reporterId, payload.reporterId)}
    reporter_name = reporter["name"]

    bug = Bug.model_validate(
        {
            **payload.model_dump(mode="json"),
            "id": bug_id,
            "ref": ref,
            "createdAt": _now(),
            "updatedAt": "just now",
            "evidence": [build_evidence_doc(e, reporter["id"]).model_dump(mode="json") for e in payload.evidence],
            "comments": [],
            "analyses": [],
            "timeline": [
                {
                    "id": "t1",
                    "kind": "created",
                    "label": "Bug created",
                    "actor": reporter_name,
                    "at": _now(),
                }
            ],
        }
    ).model_dump(mode="json")

    store.insert("bugs", bug)
    if bug.get("assigneeIds"):
        _sync_assignments(bug, list(bug["assigneeIds"]), reporter, _now(), previous_ids=[])
    _bump_project(bug, "openBugs", 1)
    _push_notification("System", f"New bug {ref} submitted by {reporter_name}.", ref)
    return bug


@router.patch("/{bug_id}")
def patch_bug(bug_id: str, payload: BugPatch, user: dict = Depends(get_current_user)) -> dict:
    store = get_store()
    store.seed_if_empty()
    bug = store.find_one("bugs", bug_id)
    if not bug:
        raise HTTPException(status_code=404, detail=f"Bug {bug_id} not found")

    updates = payload.model_dump(exclude_none=True)
    old_status = bug.get("status")
    old_assignees = list(bug.get("assigneeIds", []))
    now = _now()
    actor_name = user.get("name", user.get("id", "DevDiagnose"))

    bug.update(updates)
    bug["updatedAt"] = "just now"
    timeline = list(bug.get("timeline", []))
    names = _member_names()

    if "status" in updates and updates["status"] != old_status:
        kind = "status"
        if updates["status"] == "Resolved":
            kind = "resolved"
        elif updates["status"] == "Closed":
            kind = "closed"
        timeline.append(
            TimelineEntry(
                id=_new_id("t", timeline),
                kind=kind,
                label=f"Moved to {updates['status']}",
                actor=actor_name,
                at=now,
            ).model_dump(mode="json")
        )
        bug["timeline"] = timeline
        _push_notification("System", f"Bug {bug['ref']} moved to {updates['status']}.", bug["ref"])
        if updates["status"] == "Resolved":
            if not bug.get("resolvedAt"):
                bug["resolvedBy"] = user["id"]
                bug["resolvedAt"] = now
        if updates["status"] == "Closed":
            bug["closedAt"] = now
            if not bug.get("resolvedAt"):
                bug["resolvedBy"] = user["id"]
                bug["resolvedAt"] = now

    if "assigneeIds" in updates and updates["assigneeIds"] != old_assignees:
        timeline.append(
            TimelineEntry(
                id=_new_id("t", timeline),
                kind="assigned",
                label="Assignee updated",
                actor=actor_name,
                at=now,
            ).model_dump(mode="json")
        )
        bug["timeline"] = timeline
        _sync_assignments(bug, list(updates["assigneeIds"]), user, now)

    cleaned = Bug.model_validate(bug).model_dump(mode="json")
    store.replace("bugs", cleaned)
    return cleaned


@router.patch("/{bug_id}/status")
def set_status(bug_id: str, payload: StatusUpdate, user: dict = Depends(get_current_user)) -> dict:
    return patch_bug(bug_id, BugPatch(status=payload.status), user)


@router.post("/{bug_id}/comments")
def add_comment(bug_id: str, payload: CommentIn) -> dict:
    store = get_store()
    store.seed_if_empty()
    bug = store.find_one("bugs", bug_id)
    if not bug:
        raise HTTPException(status_code=404, detail=f"Bug {bug_id} not found")

    comments = list(bug.get("comments", []))
    timeline = list(bug.get("timeline", []))
    comment = {
        "id": _new_id("c", comments),
        "authorKind": payload.authorKind,
        "authorName": payload.authorName,
        "body": payload.body,
        "at": _now(),
    }
    comments.append(comment)
    timeline.append(
        TimelineEntry(
            id=_new_id("t", timeline),
            kind="comment",
            label="New comment",
            actor=payload.authorName,
            at=_now(),
        ).model_dump(mode="json")
    )
    bug["comments"] = comments
    bug["timeline"] = timeline
    bug["updatedAt"] = "just now"
    cleaned = Bug.model_validate(bug).model_dump(mode="json")
    store.replace("bugs", cleaned)
    _push_notification("System", f"{payload.authorName} commented on Bug {bug['ref']}.", bug["ref"])
    return cleaned


@router.post("/{bug_id}/analyze")
def analyze_bug(bug_id: str) -> dict:
    store = get_store()
    store.seed_if_empty()
    bug = store.find_one("bugs", bug_id)
    if not bug:
        raise HTTPException(status_code=404, detail=f"Bug {bug_id} not found")

    project = store.find_one("projects", bug.get("projectId", ""))
    if not project:
        project = {"name": "Unknown", "purpose": "", "modules": [], "backend": [], "frontend": [], "constraints": "", "businessRules": []}

    try:
        raw = run_analysis(bug, project)
    except GroqAnalyzerError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc

    analyses = list(bug.get("analyses", []))
    timeline = list(bug.get("timeline", []))
    version = len(analyses) + 1
    input_context = {
        "bug": {
            k: bug.get(k)
            for k in (
                "id", "ref", "title", "description", "status", "severity", "priority",
                "category", "stepsToReproduce", "expectedResult", "actualResult",
                "environment", "browserDevice", "assigneeIds", "createdAt", "updatedAt",
            )
        },
        "project": {
            k: project.get(k)
            for k in (
                "name", "purpose", "type", "modules", "backend", "frontend", "database",
                "services", "architecture", "businessRules", "constraints", "conventions",
            )
        },
        "evidence": bug.get("evidence", []),
        "comments": bug.get("comments", []),
    }
    analysis = build_analysis_doc(
        Bug.model_validate(bug),
        raw,
        version,
        context_version=f"ctx v{version} · {project.get('name', 'Unknown')}",
        input_context=input_context,
    ).model_dump(mode="json")

    analyses.append(analysis)
    timeline.append(
        TimelineEntry(
            id=_new_id("t", timeline),
            kind="ai",
            label=f"AI analysis v{version} generated",
            actor="DevDiagnose AI",
            at=_now(),
        ).model_dump(mode="json")
    )
    comments = list(bug.get("comments", []))
    comments.append(
        {
            "id": _new_id("c", comments),
            "authorKind": "AI",
            "authorName": "DevDiagnose AI",
            "body": f"Analysis v{version} complete — root cause: {raw.get('rootCause', 'N/A')}",
            "at": _now(),
        }
    )
    bug["analyses"] = analyses
    bug["timeline"] = timeline
    bug["comments"] = comments
    bug["updatedAt"] = "just now"
    cleaned = Bug.model_validate(bug).model_dump(mode="json")
    store.replace("bugs", cleaned)
    _push_notification("AI", f"AI analysis completed for Bug {bug['ref']}.", bug["ref"])
    return {"bug": cleaned, "analysis": analysis}