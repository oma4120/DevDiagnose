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
