"""Business logic for bugs: creation, report/triage edits, workflow
transitions, comments and analysis bookkeeping.

Every function receives the `Store` explicitly so the router stays a thin HTTP
shell and tests can inject a fake without patching module globals.
"""

from datetime import datetime
from uuid import uuid4

from fastapi import HTTPException

from app.config import get_settings
from app.schemas import (
    BugCreate,
    BugPatch,
    CommentIn,
    allocate_id,
    build_analysis_doc,
    build_evidence_doc,
)
from app.seed import current_bug_ref
from app.status_rules import (
    allowed_statuses,
    can_comment_on_bug,
    can_edit_bug,
    can_triage_bug,
    can_view_bug,
    display_status,
    project_bug_counts,
    visible_bug_ids,
)
from app.types import Bug, TimelineEntry

# Report content fields: editable after submitting, gated to reporter/assignees/
# project team/admin (see apply_bug_patch). Edits bump bug.reportRevision so existing
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

# Triage fields: who owns the bug and how urgent it is. Gated separately from
# report content because mis-triaging someone else's bug is as damaging as
# rewriting it.
TRIAGE_FIELDS = ("assigneeIds", "severity", "priority")


def _now() -> str:
    return datetime.now().strftime("%b %d, %Y · %H:%M")


def member_names(store) -> dict[str, str]:
    return {m["id"]: m["name"] for m in store.find_all("members")}


def _new_id(prefix: str, docs: list[dict]) -> str:
    return allocate_id(prefix, [d["id"] for d in docs if d.get("id", "").startswith(prefix)])


def project_team(store, project_id: str) -> set[str]:
    project = store.find_one("projects", project_id or "")
    return set(project.get("memberIds") or []) if project else set()


def load_visible_bug(store, bug_id: str, user: dict) -> dict:
    """Fetch a bug the caller may see, or raise 404.

    Bugs outside the caller's visible set are reported as missing so the API does
    not confirm that an id exists.
    """
    bug = store.find_one("bugs", bug_id)
    if not bug:
        raise HTTPException(status_code=404, detail=f"Bug {bug_id} not found")
    if not can_view_bug(user, bug, visible_bug_ids(user, store.find_all("projects"))):
        raise HTTPException(status_code=404, detail=f"Bug {bug_id} not found")
    return bug


def sync_assignments(
    store,
    bug: dict,
    new_assignee_ids: list[str],
    actor: dict,
    now: str,
    previous_ids: list[str] | None = None,
) -> None:
    """Reconcile bug_assignments records so they mirror bug.assigneeIds."""
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
        push_notification(
            store,
            "Assignment",
            f"Bug {bug['ref']} was assigned to you.",
            bug["ref"],
            user_ids=[dev_id],
        )


def push_notification(
    store,
    category: str,
    message: str,
    bug_ref: str | None = None,
    user_ids: list[str] | None = None,
) -> dict:
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


def recount_project(store, project_id: str) -> None:
    """Rewrite the project's stored bug counters from its live bug list."""
    project = store.find_one("projects", project_id)
    if not project:
        return
    project.update(
        project_bug_counts(
            [b for b in store.find_all("bugs") if b.get("projectId") == project_id]
        )
    )
    store.replace("projects", project)


def author_kind_for(role: str) -> str:
    """Comment authorship comes from the caller's role, never the request body."""
    return "QA" if role == "QA" else "Developer"


def create_bug_document(store, payload: BugCreate, user: dict) -> dict:
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

    # The reporter is always the caller: BugCreate carries no reporterId, so a
    # report can never be filed under someone else's identity.
    team = set(project.get("memberIds") or [])
    unknown_assignees = [a for a in payload.assigneeIds if a not in team]
    if unknown_assignees:
        raise HTTPException(
            status_code=400,
            detail="Assignees must come from the project team",
        )

    bugs = store.find_all("bugs")
    bug_id, ref = current_bug_ref(bugs)
    reporter_id = user["id"]
    reporter_name = user.get("name", reporter_id)

    # A new report always starts at Submitted. There is no status field on the
    # request body, so the workflow cannot be entered at an arbitrary stage.
    initial_status = "Submitted"

    bug = Bug.model_validate(
        {
            **payload.model_dump(mode="json"),
            "id": bug_id,
            "ref": ref,
            "reporterId": reporter_id,
            "status": initial_status,
            "createdAt": _now(),
            "updatedAt": "just now",
            "evidence": [build_evidence_doc(e, reporter_id).model_dump(mode="json") for e in payload.evidence],
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
        sync_assignments(store, bug, list(bug["assigneeIds"]), user, _now(), previous_ids=[])
    recount_project(store, bug["projectId"])
    push_notification(store, "System", f"New bug {ref} submitted by {reporter_name}.", ref)
    return bug


def apply_bug_patch(store, bug: dict, payload: BugPatch, user: dict) -> dict:
    updates = payload.model_dump(exclude_none=True)
    team = project_team(store, bug.get("projectId", ""))

    # --- Report editing ---------------------------------------------------
    report_edits = [k for k in REPORT_FIELDS if k in updates]
    if report_edits and not can_edit_bug(user, bug, team):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only the reporter, assignees, project team members, or an "
                "admin can edit this report."
            ),
        )

    # --- Triage (assignment / severity / priority) ------------------------
    # These used to be ungated, so any signed-in user could reassign or
    # re-prioritise any bug. QA is included: triaging is the QA role's job.
    triage_edits = [k for k in TRIAGE_FIELDS if k in updates]
    if triage_edits and not can_triage_bug(user, bug, team):
        raise HTTPException(
            status_code=403,
            detail=(
                "Only the reporter, assignees, project team members, QA, or an "
                "admin can change assignment, severity or priority."
            ),
        )

    # Only actual changes count: a no-op patch must not bump the revision or
    # add timeline noise.
    changed_report = [k for k in report_edits if bug.get(k) != updates[k]]
    content_changed = bool(changed_report) or any(
        k in updates and updates[k] != bug.get(k) for k in ("severity", "priority")
    )

    if "assigneeIds" in updates:
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
    names = member_names(store)

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
        push_notification(
            store,
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
                    push_notification(
                        store,
                        "Validation",
                        f"Bug {bug['ref']} is awaiting your validation.",
                        bug["ref"],
                        user_ids=targets,
                    )
            elif updates["status"] == "QA Validation":
                reporter_id = bug.get("reporterId")
                if reporter_id and reporter_id != user["id"]:
                    push_notification(
                        store,
                        "Validation",
                        f"Bug {bug['ref']} is awaiting your validation.",
                        bug["ref"],
                        user_ids=[reporter_id],
                    )
        if rejected:
            bug["needsAttention"] = True
            rejections = [a for a in (bug.get("assigneeIds") or []) if a]
            if rejections:
                push_notification(
                    store,
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
        sync_assignments(store, bug, list(updates["assigneeIds"]), user, now, previous_ids=old_assignees)

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
        push_notification(
            store,
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
    recount_project(store, cleaned["projectId"])
    return cleaned


def append_comment(store, bug: dict, payload: CommentIn, user: dict) -> dict:
    team = project_team(store, bug.get("projectId", ""))
    if not can_comment_on_bug(user, bug, team):
        raise HTTPException(
            status_code=403,
            detail="Only the reporter, assignees, project team members, or an admin can comment.",
        )

    author_name = user.get("name") or user.get("id", "Unknown")
    author_kind = author_kind_for(user.get("role", ""))

    comments = list(bug.get("comments", []))
    timeline = list(bug.get("timeline", []))
    comment = {
        "id": _new_id("c", comments),
        "authorKind": author_kind,
        "authorName": author_name,
        "body": payload.body,
        "at": _now(),
    }
    comments.append(comment)
    timeline.append(
        TimelineEntry(
            id=_new_id("t", timeline),
            kind="comment",
            label="New comment",
            actor=author_name,
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
    push_notification(
        store,
        "System",
        f"{author_name} commented on Bug {bug['ref']}.",
        bug["ref"],
        user_ids=sorted(targets) if targets else None,
    )
    return cleaned


def record_analysis(store, bug: dict, project: dict, raw: dict) -> tuple[dict, dict]:
    """Persist a fresh analysis on the bug; returns (cleaned bug, analysis doc)."""
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
    # Keep only the most recent analyses: each one embeds a full context
    # snapshot (description + evidence + comments), so an unbounded list would
    # grow the document towards Mongo's 16 MB limit. `version` is still derived
    # from the pre-trim count, so version numbers keep counting up.
    keep = get_settings().max_analyses_per_bug
    if 0 < keep < len(analyses):
        analyses = analyses[-keep:]
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
    push_notification(store, "AI", f"AI analysis completed for Bug {bug['ref']}.", bug["ref"])
    return cleaned, analysis
