"""Role-based rules for bug status transitions, plus project stat rollups."""

ALL_STATUSES = ["Draft", "Submitted", "Assigned", "In Progress", "Resolved", "QA Validation", "Closed"]

# Forward progress for developers on the project team, plus a withdraw step.
_DEVELOPER_TRANSITIONS: dict[str, set[str]] = {
    "Draft": {"Submitted"},
    "Submitted": {"In Progress"},
    "Assigned": {"In Progress"},
    "In Progress": {"Resolved"},
    "Resolved": {"In Progress"},
}

# QA picks up a resolved bug, then validates or rejects it.
_QA_TRANSITIONS: dict[str, set[str]] = {
    "Resolved": {"QA Validation", "Closed", "In Progress"},
    "QA Validation": {"Closed", "In Progress"},
}

_CLOSED_STATUSES = {"Resolved", "Closed"}


def is_open(bug: dict) -> bool:
    """A bug counts as open until it is resolved or closed."""
    return bug.get("status") not in _CLOSED_STATUSES


def project_bug_counts(bugs: list[dict]) -> dict:
    """Roll a project's bugs up into the counters stored on the project document.

    Mirrors `useProjectsBugStats` on the frontend so the API and the UI agree.
    """
    return {
        "openBugs": sum(1 for b in bugs if is_open(b)),
        "highSeverity": sum(
            1 for b in bugs if is_open(b) and b.get("severity") in ("Critical", "High")
        ),
        "resolvedBugs": sum(1 for b in bugs if not is_open(b)),
        "awaitingValidation": sum(1 for b in bugs if b.get("status") == "QA Validation"),
    }


def display_status(status: str, has_qa: bool) -> str:
    """User-facing status name: without a QA workflow the stage is just 'Validation'."""
    if status == "QA Validation" and not has_qa:
        return "Validation"
    return status


# --- visibility ------------------------------------------------------------
# Admin and QA see the whole workspace; everyone else is scoped to the projects
# they are a member of. These are the authoritative rules - the browser applies
# the same filter (frontend/src/lib/status-rules.ts) only as a display aid.

UNRESTRICTED_ROLES = ("Admin", "QA")


def sees_all_projects(role: str) -> bool:
    return role in UNRESTRICTED_ROLES


def visible_project_ids(user: dict, projects: list[dict]) -> set[str] | None:
    """Project ids `user` may see, or None when the role is unrestricted."""
    if sees_all_projects(user.get("role", "")):
        return None
    uid = user.get("id")
    return {p["id"] for p in projects if uid in (p.get("memberIds") or [])}


def can_view_bug(user: dict, bug: dict, allowed_project_ids: set[str] | None) -> bool:
    """A bug is visible inside a visible project, or to its own reporter/assignees.

    Reporter and assignee always keep access even when they later leave the
    project team, so a bug can never become orphaned from the people who own it.
    """
    if allowed_project_ids is None:
        return True
    if bug.get("projectId") in allowed_project_ids:
        return True
    uid = user.get("id")
    return uid == bug.get("reporterId") or uid in (bug.get("assigneeIds") or [])


def visible_bugs(user: dict, bugs: list[dict], projects: list[dict]) -> list[dict]:
    allowed = visible_project_ids(user, projects)
    if allowed is None:
        return bugs
    return [b for b in bugs if can_view_bug(user, b, allowed)]


def visible_projects(user: dict, projects: list[dict]) -> list[dict]:
    allowed = visible_project_ids(user, projects)
    if allowed is None:
        return projects
    return [p for p in projects if p["id"] in allowed]


def visible_bug_ids(user: dict, projects: list[dict]) -> set[str] | None:
    """Project ids whose bugs `user` may read, or None when unrestricted.

    Same scope as `visible_project_ids`; named separately so bug routes read
    clearly at the call site.
    """
    return visible_project_ids(user, projects)


def visible_notifications(user: dict, notifications: list[dict], visible_bug_list: list[dict]) -> list[dict]:
    """Filter notification rows that leak bug titles and reporters.

    A row is kept when it is addressed to the user (`userIds`) or when it points
    at a bug the user may already read. A company-wide row with neither is limited
    to the roles that can see every bug, since there is nothing to scope it by.
    `visible_bug_list` must already be scoped with `visible_bugs`.
    """
    unrestricted = sees_all_projects(user.get("role", ""))
    readable = {b.get("ref") for b in visible_bug_list} | {b.get("id") for b in visible_bug_list}
    kept = []
    for note in notifications:
        audience = note.get("userIds")
        if audience and user.get("id") not in audience:
            continue
        ref = note.get("bugRef")
        if ref and ref not in readable:
            continue
        if not audience and not ref and not unrestricted:
            continue
        kept.append(note)
    return kept


def visible_activity(user: dict, activity: list[dict]) -> list[dict]:
    """The activity feed has no bug reference, so it cannot be scoped per bug.

    Only roles that can already read every bug receive it; everyone else gets an
    empty feed rather than a company-wide summary they are not entitled to.
    """
    if not sees_all_projects(user.get("role", "")):
        return []
    return list(activity)


def can_edit_bug(user: dict, bug: dict, team: set[str]) -> bool:
    """Reporter, assignees, project team members and Admins may amend a report."""
    uid = user.get("id")
    return (
        user.get("role") == "Admin"
        or uid == bug.get("reporterId")
        or uid in set(bug.get("assigneeIds") or [])
        or uid in team
    )


def can_triage_bug(user: dict, bug: dict, team: set[str]) -> bool:
    """Who may change assignment, severity and priority.

    Same audience as report editing plus QA: a tester triaging severity and
    priority is the point of having a QA role, so QA is included even when the
    QA workflow is disabled.
    """
    return user.get("role") == "QA" or can_edit_bug(user, bug, team)


def can_comment_on_bug(user: dict, bug: dict, team: set[str]) -> bool:
    """Who may comment.

    Same audience as report editing, plus QA. QA already reads every bug and may
    triage every bug, but validating or rejecting one is meaningless without the
    ability to discuss it - so a QA member outside the project team would be
    locked out of exactly the bugs their role exists to judge.
    """
    return user.get("role") == "QA" or can_edit_bug(user, bug, team)


def allowed_statuses(
    current: str,
    role: str,
    has_qa: bool,
    is_team_member: bool,
    is_reporter: bool = False,
) -> set[str]:
    """Statuses `role` may move a bug in `current` status to.

    Admin may pick any status. QA actions require the QA workflow to be enabled.
    Developers must be on the bug's project team.

    Without a QA workflow, the developer who reported the bug AND whose fix was
    made by someone else takes over the QA role: same matrix as QA (validate,
    reject, or pick the fix up from Resolved), while the fixer waits.
    `is_reporter` means "actor is the reporter and someone else resolved it".
    """
    if role == "Admin":
        return set(ALL_STATUSES)
    if role == "QA":
        if not has_qa:
            return set()
        return set(_QA_TRANSITIONS.get(current, set()))
    if not has_qa and is_reporter and current in ("Resolved", "QA Validation"):
        return set(_QA_TRANSITIONS.get(current, set()))
    if not is_team_member:
        return set()
    return set(_DEVELOPER_TRANSITIONS.get(current, set()))
