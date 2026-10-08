"""Bug workflow over HTTP: role-gated status transitions, creation rules and
visibility of the bug list - the cases a browser exercises every day.

Each test drives the real router (no auth override shortcuts for the
transition logic): only `get_current_user` is replaced with a fixed caller.
"""

import pytest
from fastapi.testclient import TestClient

from app.deps import get_current_user
from app.routers import bugs as bugs_router
from tests.fakes import FakeStore, build_app, sign_in_as

ADMIN = {"id": "u1", "name": "Omar Admin", "email": "admin@n.dev", "role": "Admin", "status": "Active"}
QA = {"id": "u2", "name": "Sara QA", "email": "qa@n.dev", "role": "QA", "status": "Active"}
DEV = {"id": "u3", "name": "Lina Dev", "email": "dev@n.dev", "role": "Developer", "status": "Active"}
OTHER_DEV = {"id": "u4", "name": "Karim Dev", "email": "karim@n.dev", "role": "Developer", "status": "Active"}
OUTSIDER = {"id": "u9", "name": "No Access", "email": "out@n.dev", "role": "Developer", "status": "Active"}

MEMBERS = [ADMIN, QA, DEV, OTHER_DEV, OUTSIDER]

PROJECTS = [
    {"id": "p1", "name": "Payments", "description": "checkout", "memberIds": ["u1", "u2", "u3"], "environments": {}},
    {"id": "p2", "name": "Internal", "description": "admin tools", "memberIds": ["u1", "u2", "u4"], "environments": {}},
]


def _bug(**overrides) -> dict:
    bug = {
        "id": "b1",
        "ref": "#1041",
        "title": "Card declines",
        "description": "Card declines at checkout",
        "projectId": "p1",
        "status": "In Progress",
        "severity": "High",
        "priority": "Medium",
        "category": "Backend",
        "reporterId": "u3",
        "assigneeIds": ["u3"],
        "stepsToReproduce": [],
        "expectedResult": "ok",
        "actualResult": "declined",
        "environment": "",
        "browserDevice": "",
        "createdAt": "2026-01-01T00:00:00",
        "updatedAt": "2026-01-01T00:00:00",
        "evidence": [],
        "comments": [],
        "analyses": [],
        "timeline": [],
        "validatorId": None,
        "needsAttention": False,
        "resolvedBy": None,
        "resolvedAt": None,
    }
    bug.update(overrides)
    return bug


BUGS = [
    # b1: mid-fix, for the dev -> Resolved -> QA redirect.
    _bug(),
    # b2: freshly submitted, for the Submitted -> In Progress step.
    _bug(id="b2", ref="#1042", title="Duplicate rows", status="Submitted", assigneeIds=[]),
    # b3: fixed by someone else - drives the reporter-validation path.
    _bug(
        id="b3",
        ref="#1043",
        title="Leaky token",
        status="Resolved",
        assigneeIds=["u4"],
        resolvedBy="u4",
        resolvedAt="2026-01-02T00:00:00",
    ),
    # b4: on the other team - hidden from DEV, for QA to validate.
    _bug(
        id="b4",
        ref="#1044",
        title="Broken export",
        projectId="p2",
        status="QA Validation",
        reporterId="u4",
        assigneeIds=["u4"],
    ),
    # b5: outside DEV's teams, but DEV filed it -> reporter visibility.
    _bug(id="b5", ref="#1045", title="Mislabelled button", projectId="p2", status="Submitted", reporterId="u3", assigneeIds=[]),
]


@pytest.fixture(params=(True, False), ids=["qa-workflow", "no-qa-workflow"])
def has_qa(request):
    return request.param


@pytest.fixture
def store(has_qa):
    return FakeStore(
        projects=PROJECTS,
        bugs=BUGS,
        members=MEMBERS,
        company={"id": "company", "name": "Northwind", "workspace": "nw", "hasQA": has_qa, "logo": ""},
    )


@pytest.fixture
def client(store, monkeypatch):
    monkeypatch.setattr(bugs_router, "get_store", lambda: store)
    app = build_app(bugs_router.router)
    sign_in_as(app, DEV)
    return TestClient(app)


def set_status(client, bug_id: str, status: str):
    return client.patch(f"/api/bugs/{bug_id}/status", json={"status": status})


# --- transitions: happy paths ------------------------------------------------

def test_developer_moving_in_progress_to_resolved_is_sent_for_qa(client, has_qa):
    res = set_status(client, "b1", "Resolved")
    assert res.status_code == 200
    # With a QA workflow the dev cannot self-close: their fix goes to QA first.
    expected = "QA Validation" if has_qa else "Resolved"
    assert res.json()["status"] == expected


def test_developer_picks_up_a_submitted_bug(client):
    res = set_status(client, "b2", "In Progress")
    assert res.status_code == 200
    assert res.json()["status"] == "In Progress"


def test_qa_validates_a_resolved_bug_to_closed(client, store, has_qa):
    if not has_qa:
        pytest.skip("QA transitions require the QA workflow")
    sign_in_as(client.app, QA)
    res = set_status(client, "b3", "Closed")
    assert res.status_code == 200
    assert res.json()["status"] == "Closed"


def test_qa_rejecting_a_fix_flags_it_for_attention(client, store, has_qa):
    if not has_qa:
        pytest.skip("QA transitions require the QA workflow")
    sign_in_as(client.app, QA)
    res = set_status(client, "b4", "In Progress")
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "In Progress"
    assert body["needsAttention"] is True


def test_admin_may_jump_to_any_status(client):
    sign_in_as(client.app, ADMIN)
    res = set_status(client, "b2", "Closed")
    assert res.status_code == 200
    assert res.json()["status"] == "Closed"


def test_reporter_validates_someone_elses_fix_without_qa(client, store, has_qa):
    if has_qa:
        pytest.skip("reporter-validation only applies when no QA workflow exists")
    res = set_status(client, "b3", "Closed")
    assert res.status_code == 200
    assert res.json()["status"] == "Closed"


# --- transitions: denied paths ----------------------------------------------

def test_developer_cannot_close_their_own_resolved_bug(client, has_qa):
    if not has_qa:
        pytest.skip("with no QA the reporter owns validation")
    res = set_status(client, "b3", "Closed")
    assert res.status_code == 403
    assert "cannot change status" in res.json()["detail"]


def test_developer_without_a_valid_move_gets_the_allowed_list(client):
    res = set_status(client, "b1", "Closed")
    assert res.status_code == 403
    detail = res.json()["detail"]
    assert "Allowed: In Progress" in detail or "Allowed: Resolved" in detail


def test_developer_outside_the_project_team_cannot_change_status(client, has_qa):
    if not has_qa:
        pytest.skip("u4 sees b3 only as an assignee; the no-QA reporter path differs")
    sign_in_as(client.app, OTHER_DEV)
    res = set_status(client, "b3", "In Progress")
    assert res.status_code == 403
    assert "Allowed: none" in res.json()["detail"]


def test_qa_without_the_workflow_cannot_change_status(client, store, has_qa):
    if has_qa:
        pytest.skip("covers the QA-workflow-off case only")
    sign_in_as(client.app, QA)
    res = set_status(client, "b3", "Closed")
    assert res.status_code == 403


def test_hidden_bug_reads_as_not_found_for_outsiders(client):
    # u9 belongs to no project: the API must not confirm the id exists.
    sign_in_as(client.app, OUTSIDER)
    assert set_status(client, "b1", "Closed").status_code == 404
    assert client.get("/api/bugs/b1").status_code == 404


# --- creation rules ----------------------------------------------------------

def test_new_report_always_starts_at_submitted(client):
    res = client.post(
        "/api/bugs",
        json={
            "title": "Spoofed stage",
            "description": "try to enter at Closed",
            "projectId": "p1",
            # Neither field exists on BugCreate; both must be ignored.
            "status": "Closed",
            "reporterId": "u1",
        },
    )
    assert res.status_code == 201
    body = res.json()
    assert body["status"] == "Submitted"
    assert body["reporterId"] == DEV["id"]


def test_creating_a_bug_on_a_foreign_project_is_denied(client):
    res = client.post(
        "/api/bugs",
        json={"title": "Nope", "description": "other team", "projectId": "p2"},
    )
    assert res.status_code == 403


def test_creating_a_bug_on_an_unknown_project_is_not_found(client):
    res = client.post(
        "/api/bugs",
        json={"title": "Nope", "description": "ghost project", "projectId": "p99"},
    )
    assert res.status_code == 404


def test_assignees_must_come_from_the_project_team(client):
    res = client.post(
        "/api/bugs",
        json={
            "title": "Bad assignee",
            "description": "outsider cannot own work here",
            "projectId": "p1",
            "assigneeIds": ["u9"],
        },
    )
    assert res.status_code == 400
    assert "project team" in res.json()["detail"]


def test_screenshot_evidence_must_carry_an_embedded_image(client):
    res = client.post(
        "/api/bugs",
        json={
            "title": "Bad screenshot",
            "description": "external url",
            "projectId": "p1",
            "evidence": [{"type": "Screenshot", "fileUrl": "https://example.com/x.png"}],
        },
    )
    assert res.status_code == 422


# --- visibility --------------------------------------------------------------

def test_developer_sees_their_team_and_their_own_reports_elsewhere(client):
    refs = [b["ref"] for b in client.get("/api/bugs").json()]
    assert "#1041" in refs and "#1042" in refs and "#1043" in refs  # team p1
    assert "#1045" in refs  # DEV filed it on p2 - reporter exemption
    assert "#1044" not in refs  # other team, not DEV's report


def test_admin_and_qa_see_every_bug(client, store):
    for user in (ADMIN, QA):
        sign_in_as(client.app, user)
        refs = [b["ref"] for b in client.get("/api/bugs").json()]
        assert len(refs) == 5


def test_reporter_keeps_access_after_leaving_the_team(client, store):
    # Remove DEV from p1: the bug they filed must stay readable to them.
    store.patch("projects", "p1", {"memberIds": ["u1", "u2"]})
    assert client.get("/api/bugs/b1").status_code == 200


# --- report edits ------------------------------------------------------------

def test_report_edit_bumps_the_revision_so_analyses_go_stale(client):
    first = client.patch("/api/bugs/b1", json={"title": "Card decline at checkout"})
    assert first.status_code == 200
    assert first.json()["reportRevision"] == 1

    # A no-op edit must not bump anything (no revision churn, no timeline noise).
    same = client.patch("/api/bugs/b1", json={"title": "Card decline at checkout"})
    assert same.status_code == 200
    assert same.json()["reportRevision"] == 1


def test_outsider_cannot_edit_a_report(client):
    sign_in_as(client.app, OUTSIDER)
    # Visible only through... no: u9 cannot even see b1, so 404.
    assert client.patch("/api/bugs/b1", json={"title": "tampered"}).status_code == 404
