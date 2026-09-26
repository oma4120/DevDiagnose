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
from app.status_rules import allowed_statuses, display_status, project_bug_counts
from app.types import Bug, TimelineEntry

router = APIRouter(prefix="/bugs", tags=["bugs"])


def _now() -> str:
    return datetime.now().strftime("%b %d, %Y · %H:%M")


def _member_names() -> dict[str, str]:
    store = get_store()
    return {m["id"]: m["name"] for m in store.find_all("members")}


def _new_id(prefix: str, docs: list[dict]) -> str:
    return allocate_id(prefix, [d["id"] for d in docs if d.get("id", "").startswith(prefix)])


# Report content fields: editable after submitting, gated to reporter/assignees/
# project team/admin (see patch_bug). Edits bump bug.reportRevision so existing
# AI analyses are flagged as stale.
REPORT_FIELDS = (
    "title",
    "description",
    "category",
    "stepsToReproduce",
    "expectedResult",
    "actualResult",
    "environment",
    "browserDevice",
)
REPORT_LABELS = {
    "title": "title",
    "description": "description",
    "category": "category",
    "stepsToReproduce": "steps to reproduce",
    "expectedResult": "expected result",
    "actualResult": "actual result",
    "environment": "environment",
    "browserDevice": "browser/device",
}


def _sync_assignments(
    bug: dict,
    new_assignee_ids: list[str],
    actor: dict,
    now: str,
    previous_ids: list[str] | None = None,
) -> None:
    """Reconcile bug_assignments records so they mirror bug.assigneeIds."""
    store = get_store()
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
            f"Bug {bug['ref']} was assigned to you.",
            bug["ref"],
            user_ids=[dev_id],
        )


def _push_notification(
    category: str,
    message: str,
    bug_ref: str | None = None,
    user_ids: list[str] | None = None,
) -> dict:
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
    if user_ids:
        note["userIds"] = user_ids
    store.insert("notifications", note)
    return note


def _recount_project(project_id: str) -> None:
    """Rewrite the project's stored bug counters from its live bug list."""
    store = get_store()
    project = store.find_one("projects", project_id)
    if not project:
        return
    project.update(
        project_bug_counts(
            [b for b in store.find_all("bugs") if b.get("projectId") == project_id]
        )
    )
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

    project = store.find_one("projects", payload.projectId)
    if not project:
        raise HTTPException(status_code=404, detail=f"Project {payload.projectId} not found")
    if user.get("role") != "Admin" and user.get("id") not in (project.get("memberIds") or []):
        raise HTTPException(status_code=403, detail="You don't have access to this project")

    for e in payload.evidence:
        if e.type == "Screenshot" and not (e.fileUrl or "").startswith("data:image/"):
            raise HTTPException(
                status_code=422,
                detail="Screenshot evidence must include an image (data:image/…).",
            )

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
    _recount_project(bug["projectId"])
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

    # --- Report editing ---------------------------------------------------
    report_edits = [k for k in REPORT_FIELDS if k in updates]
    if report_edits:
        project = store.find_one("projects", bug.get("projectId", ""))
        team = set(project.get("memberIds") or []) if project else set()
        uid = user.get("id")
        if not (
            user.get("role") == "Admin"
            or uid == bug.get("reporterId")
            or uid in set(bug.get("assigneeIds") or [])
            or uid in team
        ):
            raise HTTPException(
                status_code=403,
                detail=(
                    "Only the reporter, assignees, project team members, or an "
                    "admin can edit this report."
                ),
            )
    # Only actual changes count: a no-op patch must not bump the revision or
    # add timeline noise.
    changed_report = [k for k in report_edits if bug.get(k) != updates[k]]
    content_changed = bool(changed_report) or any(
        k in updates and updates[k] != bug.get(k) for k in ("severity", "priority")
    )

    if "assigneeIds" in updates:
        project = store.find_one("projects", bug.get("projectId", ""))
        team = set(project.get("memberIds") or []) if project else set()
        if any(member_id not in team for member_id in updates["assigneeIds"]):
            raise HTTPException(
                status_code=400,
                detail="Assignees must come from the project team",
            )
        if updates["assigneeIds"] and "status" not in updates and bug.get("status") == "Submitted":
            updates["status"] = "Assigned"

    old_status = bug.get("status")
    old_assignees = list(bug.get("assigneeIds", []))
    now = _now()
    actor_name = user.get("name", user.get("id", "DevDiagnose"))
    has_qa = bool(store.company().get("hasQA", True))

    # Enforce role-based status transitions for explicit status changes only
    # (the auto "Submitted -> Assigned" bump on assignment stays internal).
    if payload.status is not None and payload.status != old_status:
        project = store.find_one("projects", bug.get("projectId", ""))
        team = set(project.get("memberIds") or []) if project else set()
        allowed = allowed_statuses(
            old_status,
            user.get("role", ""),
            has_qa,
            user.get("id") in team,
            is_reporter=(
                user.get("id") == bug.get("reporterId")
                and user.get("id") != bug.get("resolvedBy")
            ),
        )
        if payload.status not in allowed:
            options = (
                ", ".join(sorted(display_status(s, has_qa) for s in allowed))
                if allowed
                else "none"
            )
            raise HTTPException(
                status_code=403,
                detail=(
                    f"Role '{user.get('role')}' cannot change status from "
                    f"'{display_status(old_status, has_qa)}' to "
                    f"'{display_status(payload.status, has_qa)}'. Allowed: {options}."
                ),
            )

    # A non-admin pressing "Resolved" from In Progress is routed to a validation
    # stage instead: with the QA workflow on, QA picks it up; with no QA, the
    # developer who reported the bug validates fixes made by anyone else
    # (resolving your own bug with no QA stays a plain Resolved = done).
    resolved_redirect = False
    if (
        payload.status == "Resolved"
        and old_status == "In Progress"
        and user.get("role") != "Admin"
        and (has_qa or user.get("id") != bug.get("reporterId"))
    ):
        updates["status"] = "QA Validation"
        resolved_redirect = True

    bug.update(updates)
    if resolved_redirect and not has_qa:
        bug["validatorId"] = bug.get("reporterId")
    bug["updatedAt"] = "just now"
    timeline = list(bug.get("timeline", []))
    names = _member_names()

    if "status" in updates and updates["status"] != old_status:
        kind = "status"
        if updates["status"] == "Resolved" or resolved_redirect:
            kind = "resolved"
        elif updates["status"] == "Closed":
            kind = "closed"
        # A Developer moving back from Resolved/QA Validation is withdrawing their
        # own fix, not a rejection: no "Rejected" label, no needsAttention flag.
        # Exception: without a QA workflow, the reporter pulling someone else's
        # fix back IS the validator rejecting it.
        rejected = (
            updates["status"] == "In Progress"
            and old_status in ("Resolved", "QA Validation")
            and (
                user.get("role") != "Developer"
                or (
                    not has_qa
                    and user.get("id") == bug.get("reporterId")
                    and user.get("id") != bug.get("resolvedBy")
                )
            )
        )
        if resolved_redirect:
            label = (
                "Resolved - sent for QA validation"
                if has_qa
                else "Resolved - sent to the reporter for validation"
            )
        elif rejected:
            label = "Rejected - needs changes"
        else:
            label = f"Moved to {display_status(updates['status'], has_qa)}"
        timeline.append(
            TimelineEntry(
                id=_new_id("t", timeline),
                kind=kind,
                label=label,
                actor=actor_name,
                at=now,
            ).model_dump(mode="json")
        )
        bug["timeline"] = timeline
        _push_notification(
            "System",
            f"Bug {bug['ref']} moved to {display_status(updates['status'], has_qa)}.",
            bug["ref"],
        )
        if updates["status"] in ("Resolved", "QA Validation"):
            if has_qa:
                project = store.find_one("projects", bug.get("projectId", ""))
                team = set(project.get("memberIds") or []) if project else set()
                all_members = store.find_all("members")
                qa_ids = [m["id"] for m in all_members if m.get("role") == "QA"]
                targets = [q for q in qa_ids if q in team] or qa_ids
                if targets:
                    _push_notification(
                        "Validation",
                        f"Bug {bug['ref']} is awaiting your validation.",
                        bug["ref"],
                        user_ids=targets,
                    )
            elif updates["status"] == "QA Validation":
                reporter_id = bug.get("reporterId")
                if reporter_id and reporter_id != user["id"]:
                    _push_notification(
                        "Validation",
                        f"Bug {bug['ref']} is awaiting your validation.",
                        bug["ref"],
                        user_ids=[reporter_id],
                    )
        if rejected:
            bug["needsAttention"] = True
            rejections = [a for a in (bug.get("assigneeIds") or []) if a]
            if rejections:
                _push_notification(
                    "Validation",
                    f"Bug {bug['ref']} was rejected - it needs your attention.",
                    bug["ref"],
                    user_ids=rejections,
                )
        else:
            bug["needsAttention"] = False
        if updates["status"] == "Resolved" or resolved_redirect:
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
        _sync_assignments(bug, list(updates["assigneeIds"]), user, now, previous_ids=old_assignees)

    if changed_report:
        timeline.append(
            TimelineEntry(
                id=_new_id("t", timeline),
                kind="edited",
                label="Report updated: " + ", ".join(REPORT_LABELS[k] for k in changed_report),
                actor=actor_name,
                at=now,
            ).model_dump(mode="json")
        )
        bug["timeline"] = timeline
        targets = {bug.get("reporterId"), *bug.get("assigneeIds", [])}
        targets.discard(None)
        targets.discard(user.get("id"))
        _push_notification(
            "System",
            f"{actor_name} updated the report of Bug {bug['ref']}.",
            bug["ref"],
            user_ids=sorted(targets) if targets else None,
        )
    if content_changed:
        # Analyses stored before this edit are now stale (frontend compares
        # bug.reportRevision against analysis.reportRevision).
        bug["reportRevision"] = int(bug.get("reportRevision") or 0) + 1

    cleaned = Bug.model_validate(bug).model_dump(mode="json")
    store.replace("bugs", cleaned)
    _recount_project(cleaned["projectId"])
    return cleaned


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
    targets = {bug.get("reporterId"), *bug.get("assigneeIds", [])}
    targets.discard(None)
    targets.discard(user.get("id"))
    _push_notification(
        "System",
        f"{payload.authorName} commented on Bug {bug['ref']}.",
        bug["ref"],
        user_ids=sorted(targets) if targets else None,
    )
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
        # Screenshots are display-only: the model never sees them, so they are
        # excluded from the stored context snapshot too (keeps base64 out as well).
        # Same for the AI's own comments (they aren't sent to the model either).
        "evidence": [e for e in bug.get("evidence", []) if e.get("type") != "Screenshot"],
        "comments": [c for c in bug.get("comments", []) if c.get("authorKind") != "AI"],
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
            "body": f"Analysis v{version} complete - root cause: {raw.get('rootCause', 'N/A')}",
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