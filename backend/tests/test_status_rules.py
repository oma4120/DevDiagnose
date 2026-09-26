"""Rules that decide who may see, edit and move a bug.

These are pure functions, so the whole authorization surface is table-testable
without a database. `allowed_statuses` and `project_bug_counts` are mirrored in
frontend/src/lib/status-rules.ts and frontend/src/lib/data-context.tsx.
"""

import pytest

from app.status_rules import (
    ALL_STATUSES,
    allowed_statuses,
    can_comment_on_bug,
    can_edit_bug,
    can_triage_bug,
    can_view_bug,
    display_status,
    is_open,
    project_bug_counts,
    sees_all_projects,
    visible_bug_ids,
    visible_bugs,
    visible_project_ids,
    visible_projects,
)

ADMIN = {"id": "u1", "role": "Admin"}
QA = {"id": "u2", "role": "QA"}
DEV = {"id": "u3", "role": "Developer"}
OUTSIDER = {"id": "u9", "role": "Developer"}


# --- status matrix --------------------------------------------------------

def test_status_enum_order_is_resolved_before_qa_validation():
    # The enum order is load-bearing: a developer resolves, then QA validates.
    assert ALL_STATUSES.index("Resolved") < ALL_STATUSES.index("QA Validation")
    assert ALL_STATUSES[0] == "Draft"


@pytest.mark.parametrize(
    "status,expected",
    [
        ("Draft", {"Submitted"}),
        ("Submitted", {"In Progress"}),
        ("Assigned", {"In Progress"}),
        ("In Progress", {"Resolved"}),
        ("Resolved", {"In Progress"}),
        ("QA Validation", set()),
        ("Closed", set()),
    ],
)
def test_developer_transitions(status, expected):
    assert allowed_statuses(status, "Developer", has_qa=True, is_team_member=True) == expected


def test_admin_may_pick_any_status():
    assert allowed_statuses("Closed", "Admin", has_qa=True, is_team_member=False) == set(ALL_STATUSES)


def test_non_team_member_developer_has_no_moves():
    assert allowed_statuses("In Progress", "Developer", has_qa=True, is_team_member=False) == set()


def test_qa_validates_or_rejects_from_resolved():
    assert allowed_statuses("Resolved", "QA", has_qa=True, is_team_member=False) == {
        "QA Validation",
        "Closed",
        "In Progress",
    }
    assert allowed_statuses("QA Validation", "QA", has_qa=True, is_team_member=False) == {
        "Closed",
        "In Progress",
    }


def test_qa_is_locked_out_when_qa_workflow_is_off():
    assert allowed_statuses("Resolved", "QA", has_qa=False, is_team_member=False) == set()


def test_without_qa_the_reporter_validates_someone_elses_fix():
    # Reporter who did not resolve it takes over the QA role.
    assert allowed_statuses("Resolved", "Developer", has_qa=False, is_team_member=True, is_reporter=True) == {
        "QA Validation",
        "Closed",
        "In Progress",
    }
    # A developer who resolved their own bug does not validate it.
    assert allowed_statuses("Resolved", "Developer", has_qa=False, is_team_member=True, is_reporter=False) == {
        "In Progress"
    }


def test_display_status_renames_validation_without_qa():
    assert display_status("QA Validation", has_qa=False) == "Validation"
    assert display_status("QA Validation", has_qa=True) == "QA Validation"
    assert display_status("Resolved", has_qa=False) == "Resolved"


# --- counters -------------------------------------------------------------

def test_is_open_until_resolved_or_closed():
    assert is_open({"status": "In Progress"})
    assert is_open({"status": "Draft"})
    assert not is_open({"status": "Resolved"})
    assert not is_open({"status": "Closed"})


def test_project_counters_roll_up():
    bugs = [
        {"status": "In Progress", "severity": "Critical"},
        {"status": "QA Validation", "severity": "High"},
        {"status": "Submitted", "severity": "Low"},
        {"status": "Resolved", "severity": "High"},
        {"status": "Closed", "severity": "Low"},
    ]
    assert project_bug_counts(bugs) == {
        "openBugs": 3,
        "highSeverity": 2,  # Critical + High, but only while still open
        "resolvedBugs": 2,
        "awaitingValidation": 1,
    }


def test_project_counters_of_empty_project():
    assert project_bug_counts([]) == {
        "openBugs": 0,
        "highSeverity": 0,
        "resolvedBugs": 0,
        "awaitingValidation": 0,
    }


# --- visibility -----------------------------------------------------------

PROJECTS = [
    {"id": "p1", "memberIds": ["u1", "u2", "u3"]},
    {"id": "p2", "memberIds": ["u1", "u2", "u4"]},
]


def test_admin_and_qa_see_every_project():
    assert sees_all_projects("Admin")
    assert sees_all_projects("QA")
    assert not sees_all_projects("Developer")


def test_admin_and_qa_are_unrestricted():
    assert visible_project_ids(ADMIN, PROJECTS) is None
    assert visible_bug_ids(QA, PROJECTS) is None
    assert len(visible_projects(QA, PROJECTS)) == 2


def test_developer_sees_only_own_projects():
    assert visible_project_ids(DEV, PROJECTS) == {"p1"}
    assert [p["id"] for p in visible_projects(DEV, PROJECTS)] == ["p1"]


def test_outsider_sees_no_projects():
    assert visible_project_ids(OUTSIDER, PROJECTS) == set()
    assert visible_projects(OUTSIDER, PROJECTS) == []


def test_bug_in_visible_project_is_visible():
    assert can_view_bug(DEV, {"projectId": "p1", "reporterId": "u7"}, {"p1"})


def test_bug_in_hidden_project_is_not_visible():
    assert not can_view_bug(DEV, {"projectId": "p2", "reporterId": "u7"}, {"p1"})


def test_reporter_keeps_access_after_leaving_the_team():
    bug = {"projectId": "p2", "reporterId": "u3", "assigneeIds": []}
    assert can_view_bug(DEV, bug, {"p1"})


def test_assignee_keeps_access_after_leaving_the_team():
    bug = {"projectId": "p2", "reporterId": "u7", "assigneeIds": ["u3"]}
    assert can_view_bug(DEV, bug, {"p1"})


def test_unrelated_bug_stays_hidden():
    bug = {"projectId": "p2", "reporterId": "u7", "assigneeIds": ["u4"]}
    assert not can_view_bug(DEV, bug, {"p1"})


def test_visible_bugs_scoping_matches_per_bug_rule():
    bugs = [
        {"id": "b1", "projectId": "p1", "reporterId": "u3", "assigneeIds": []},
        {"id": "b2", "projectId": "p2", "reporterId": "u3", "assigneeIds": []},
        {"id": "b3", "projectId": "p2", "reporterId": "u7", "assigneeIds": ["u4"]},
    ]
    assert [b["id"] for b in visible_bugs(DEV, bugs, PROJECTS)] == ["b1", "b2"]


def test_unrestricted_roles_get_the_full_bug_list():
    bugs = [{"id": "b1", "projectId": "p2", "reporterId": "u7", "assigneeIds": []}]
    assert visible_bugs(QA, bugs, PROJECTS) == bugs
    assert visible_bugs(ADMIN, bugs, PROJECTS) == bugs


# --- edit / triage / comment ----------------------------------------------

BUG = {"id": "b1", "projectId": "p1", "reporterId": "u7", "assigneeIds": ["u3"]}
TEAM = {"u1", "u2", "u3"}


@pytest.mark.parametrize("user", [ADMIN, QA, DEV])
def test_admin_qa_and_team_may_edit_the_report(user):
    assert can_edit_bug(user, BUG, TEAM)


def test_reporter_outside_the_team_may_edit_their_own_report():
    assert can_edit_bug({"id": "u7", "role": "Developer"}, BUG, TEAM)


def test_outsider_may_not_edit_a_report():
    assert not can_edit_bug(OUTSIDER, BUG, TEAM)


def test_qa_may_triage_even_outside_the_project_team():
    # Triaging severity/priority is the QA role's job, so QA is included.
    assert can_triage_bug(QA, BUG, set())


def test_team_member_may_triage():
    assert can_triage_bug(DEV, BUG, TEAM)


def test_outsider_may_not_triage():
    # The bug that shipped ungated: any signed-in user could retriage anything.
    assert not can_triage_bug(OUTSIDER, BUG, TEAM)


def test_commenting_follows_the_edit_rule():
    assert can_comment_on_bug(DEV, BUG, TEAM)
    assert not can_comment_on_bug(OUTSIDER, BUG, TEAM)


def test_qa_may_comment_outside_the_project_team():
    # QA reads and triages every bug, so it must be able to discuss them too,
    # even when it is not on the project team.
    assert not can_edit_bug(QA, BUG, set())
    assert can_comment_on_bug(QA, BUG, set())


def test_a_developer_outside_the_team_still_cannot_comment():
    # Only QA is granted by role; a Developer is not.
    assert not can_comment_on_bug(OUTSIDER, BUG, set())
