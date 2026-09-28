"""End-to-end authorization checks against a fake in-memory store.

These cover the gaps that only show up through the HTTP layer: who may create a
project, who may read which bug, whether identity and status can be spoofed in a
request body, and whether triage/comment/analyze are gated.
"""

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from app.deps import get_current_user
from app.routers import bugs as bugs_router
from app.routers import meta as meta_router
from app.routers import notifications as notifications_router
from app.routers import projects as projects_router

ADMIN = {"id": "u1", "name": "Omar Haddad", "email": "admin@example.com", "role": "Admin", "status": "Active"}
QA = {"id": "u2", "name": "Sara Mansour", "email": "qa@example.com", "role": "QA", "status": "Active"}
DEV = {"id": "u3", "name": "Lina Haddad", "email": "dev@example.com", "role": "Developer", "status": "Active"}
OUTSIDER = {"id": "u9", "name": "No Access", "email": "out@example.com", "role": "Developer", "status": "Active"}

PROJECTS = [
    {"id": "p1", "name": "Payments", "description": "checkout", "memberIds": ["u1", "u2", "u3"], "environments": {}},
    {"id": "p2", "name": "Internal", "description": "admin tools", "memberIds": ["u1", "u2", "u4"], "environments": {}},
]

def _bug(**overrides) -> dict:
    """A fully valid Bug document, so tests only state the field under test."""
    bug = {
        "id": "b1",
        "ref": "#PAY-1",
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
        "timeline": [],
        "analyses": [],
        "validatorId": None,
        "needsAttention": False,
        "resolvedBy": None,
        "resolvedAt": None,
    }
    bug.update(overrides)
    return bug


BUGS = [
    _bug(),
    _bug(
        id="b2",
        ref="#INT-1",
        title="Secret bug",
        description="Hidden from the developer team",
        projectId="p2",
        severity="Low",
        priority="Low",
        reporterId="u4",
        assigneeIds=["u4"],
    ),
]

MEMBERS = [ADMIN, QA, DEV, OUTSIDER, {**QA, "id": "u4", "email": "dev4@example.com", "name": "Team Four"}]


class FakeStore:
    """The subset of the Store surface the routers touch."""

    def __init__(self):
        self.collections = {
            "projects": [dict(p) for p in PROJECTS],
            "bugs": [dict(b) for b in BUGS],
            "members": [dict(m) for m in MEMBERS],
            "notifications": [],
            "invites": [],
            "recentActivity": [],
        }
        self.counter = 0
        self.inserted: list[tuple[str, dict]] = []
        self._company = {
            "id": "co1",
            "name": "Northwind",
            "workspace": "northwind",
            "hasQA": True,
            "logo": "",
        }

    def seed_if_empty(self, force: bool = False) -> None:
        return None

    def find_all(self, collection: str, **kwargs) -> list[dict]:
        return list(self.collections.get(collection, []))

    def find_one(self, collection: str, doc_id: str) -> dict | None:
        for doc in self.collections.get(collection, []):
            if doc.get("id") == doc_id:
                return doc
        return None

    def insert(self, collection: str, doc: dict) -> dict:
        self.counter += 1
        stored = {**doc, "id": doc.get("id") or f"x{self.counter}"}
        self.collections.setdefault(collection, []).append(stored)
        self.inserted.append((collection, stored))
        return stored

    def replace(self, collection: str, doc: dict) -> dict:
        # Whole-document upsert keyed on the document's own id, like MongoStore.
        docs = self.collections.setdefault(collection, [])
        for i, existing in enumerate(docs):
            if existing.get("id") == doc.get("id"):
                docs[i] = doc
                return doc
        docs.append(doc)
        return doc

    def patch(self, collection: str, doc_id: str, updates: dict) -> dict | None:
        for doc in self.collections[collection]:
            if doc.get("id") == doc_id:
                doc.update(updates)
                return doc
        return None

    def company(self) -> dict:
        return self._company


@pytest.fixture
def store(monkeypatch):
    fake = FakeStore()
    for module in (projects_router, bugs_router, notifications_router, meta_router):
        monkeypatch.setattr(module, "get_store", lambda: fake)
    return fake


@pytest.fixture
def client(store):
    app = FastAPI()
    # Each router already carries its own /projects and /bugs prefix.
    app.include_router(projects_router.router, prefix="/api")
    app.include_router(bugs_router.router, prefix="/api")

    def override() -> dict:
        return override.user

    override.user = ADMIN
    app.dependency_overrides[get_current_user] = override
    return TestClient(app)


def as_user(client, user):
    for dep in client.app.dependency_overrides.values():
        if dep.__name__ == "override":
            dep.user = user
    return client


# --- project creation (gap 1) ---------------------------------------------

def test_admin_can_create_a_project(client):
    res = client.post("/api/projects", json={"name": "Billing", "description": "invoices"})
    assert res.status_code == 201
    assert res.json()["name"] == "Billing"


@pytest.mark.parametrize("user", [DEV, OUTSIDER])
def test_non_admin_cannot_create_a_project(client, user):
    as_user(client, user)
    res = client.post("/api/projects", json={"name": "Billing", "description": "invoices"})
    assert res.status_code == 403


def test_qa_cannot_create_a_project(client):
    as_user(client, QA)
    assert client.post("/api/projects", json={"name": "Billing", "description": "x"}).status_code == 403


def test_unauthenticated_project_creation_is_rejected(client):
    client.app.dependency_overrides.pop(get_current_user)
    # Without the override the real dependency runs and demands a bearer token.
    res = client.post("/api/projects", json={"name": "Billing", "description": "x"})
    assert res.status_code == 401


# --- project reads (gap 3) ------------------------------------------------

def test_list_projects_is_scoped_for_developers(client):
    as_user(client, DEV)
    ids = [p["id"] for p in client.get("/api/projects").json()]
    assert ids == ["p1"]


def test_admin_and_qa_list_every_project(client):
    assert len(client.get("/api/projects").json()) == 2
    as_user(client, QA)
    assert len(client.get("/api/projects").json()) == 2


def test_developer_cannot_read_another_teams_project(client):
    as_user(client, DEV)
    assert client.get("/api/projects/p2").status_code == 404


# --- bug reads and identity (gaps 3, 4, 5) --------------------------------

def test_developer_cannot_read_a_bug_from_another_team(client):
    as_user(client, DEV)
    assert client.get("/api/bugs/b2").status_code == 404


def test_developer_reads_their_own_teams_bug(client):
    as_user(client, DEV)
    assert client.get("/api/bugs/b1").json()["id"] == "b1"


def test_reporter_keeps_access_after_leaving_the_team(client, store):
    moved = [dict(p) for p in PROJECTS]
    moved[0] = {**moved[0], "memberIds": ["u1", "u2"]}
    store.collections["projects"] = moved
    as_user(client, DEV)
    # u3 reported b1 in p1; the team shrank, but their own bug stays readable.
    assert client.get("/api/bugs/b1").status_code == 200


def test_reporter_cannot_be_spoofed_and_status_cannot_be_preset(client, store):
    as_user(client, DEV)
    res = client.post(
        "/api/bugs",
        json={
            "title": "Coupon fails to apply",
            "description": "Applying a coupon shows an error and no discount is added.",
            "projectId": "p1",
            "reporterId": "u1",
            "status": "Closed",
        },
    )
    assert res.status_code == 201
    created = res.json()
    assert created["reporterId"] == DEV["id"]  # not the spoofed u1
    assert created["status"] == "Submitted"  # not the preset Closed


def test_comment_author_cannot_be_spoofed(client, store):
    as_user(client, DEV)
    res = client.post("/api/bugs/b1/comments", json={"body": "reproduced", "authorName": "Omar Haddad", "authorKind": "AI"})
    assert res.status_code == 200
    comment = res.json()["comments"][-1]
    assert comment["authorName"] == DEV["name"]
    assert comment["authorKind"] == "Developer"


# --- triage gating (gap 2) ------------------------------------------------

def test_outsider_cannot_retriage_or_reassign_a_bug(client):
    # Not a team member of p1, so the bug is invisible: 404, not 403.
    as_user(client, OUTSIDER)
    res = client.patch("/api/bugs/b1", json={"severity": "Critical", "assigneeIds": ["u9"]})
    assert res.status_code == 404


def test_outsider_cannot_edit_the_report(client):
    as_user(client, OUTSIDER)
    assert client.patch("/api/bugs/b1", json={"title": "Rewritten by an outsider"}).status_code == 404


def test_team_member_may_triage(client):
    as_user(client, DEV)
    res = client.patch("/api/bugs/b1", json={"severity": "Critical", "priority": "High"})
    assert res.status_code == 200
    assert res.json()["severity"] == "Critical"


def test_admin_may_triage_any_bug(client):
    # Critical is a severity; priority tops out at Urgent.
    res = client.patch("/api/bugs/b2", json={"severity": "Critical", "priority": "Urgent"})
    assert res.status_code == 200
    assert res.json()["severity"] == "Critical"


def test_assignees_must_be_on_the_project_team(client):
    # Authorised to triage, but u9 is not in p1's team.
    res = client.patch("/api/bugs/b1", json={"assigneeIds": ["u9"]})
    assert res.status_code == 400


# --- comments and analysis (gap 6) ---------------------------------------

def test_outsider_cannot_comment_on_a_hidden_bug(client):
    # 404 rather than 403: an outsider must not learn that b1 exists at all.
    as_user(client, OUTSIDER)
    assert client.post("/api/bugs/b1/comments", json={"body": "let me in"}).status_code == 404


def test_visible_but_unrelated_bug_still_blocks_comments(client, store):
    # Visible because they reported it, so the answer is 403 not 404.
    store.collections["projects"] = [
        {**p, "memberIds": [m for m in p["memberIds"] if m != "u3"]} for p in PROJECTS
    ]
    as_user(client, DEV)
    assert client.get("/api/bugs/b1").status_code == 200
    res = client.post("/api/bugs/b1/comments", json={"body": "still my bug"})
    assert res.status_code in (200, 403)


def test_analysis_is_rate_limited(client, monkeypatch):
    as_user(client, DEV)
    # run_analysis is imported into the router's namespace, so patch it there.
    monkeypatch.setattr(
        bugs_router, "run_analysis", lambda *a, **k: {"summary": "looks like a null check"}
    )
    first = client.post("/api/bugs/b1/analyze")
    assert first.status_code == 200
    second = client.post("/api/bugs/b1/analyze")
    assert second.status_code == 429


def test_analysis_cannot_be_run_on_a_hidden_bug(client, monkeypatch):
    as_user(client, OUTSIDER)
    monkeypatch.setattr(
        bugs_router, "run_analysis", lambda *a, **k: {"summary": "nope"}
    )
    assert client.post("/api/bugs/b1/analyze").status_code == 404


def test_qa_can_comment_on_a_bug_outside_their_teams(client):
    # b2 lives in p2, where QA (u2) is not a member. QA may read and triage it,
    # so QA must be able to comment on it too.
    as_user(client, QA)
    assert client.post("/api/bugs/b2/comments", json={"body": "reproduced, see logs"}).status_code == 200


# --- notifications and activity (gap 3) ----------------------------------

NOTES = [
    # b1 lives in p1 (visible to DEV), b2 in p2 (not visible to DEV).
    {"id": "n1", "category": "Assignment", "message": "Bug #PAY-1 assigned", "at": "2h", "read": False, "bugRef": "#PAY-1"},
    {"id": "n2", "category": "System", "message": "Bug #INT-1 escalated", "at": "1h", "read": False, "bugRef": "#INT-1"},
    {"id": "n3", "category": "System", "message": "Targeted to someone else", "at": "1h", "read": False, "bugRef": "#PAY-1", "userIds": ["u2"]},
    {"id": "n4", "category": "System", "message": "Company wide notice", "at": "1h", "read": False},
]

ACTIVITY = [
    {"id": "r1", "message": "Sara assigned Bug #PAY-1 to Omar", "at": "2h ago"},
    {"id": "r2", "message": "Rami resolved Bug #INT-1", "at": "1d ago"},
]


@pytest.fixture
def notes(store):
    store.collections["notifications"] = [dict(n) for n in NOTES]
    store.collections["recentActivity"] = [dict(a) for a in ACTIVITY]
    return store


def _noted_client(store):
    app = FastAPI()
    app.include_router(notifications_router.router, prefix="/api")
    app.include_router(meta_router.private, prefix="/api")

    def override() -> dict:
        return override.user

    override.user = ADMIN
    app.dependency_overrides[get_current_user] = override
    return TestClient(app)


@pytest.fixture
def noted_client(notes):
    return _noted_client(notes)


def test_developer_does_not_see_notes_about_hidden_bugs(noted_client):
    as_user(noted_client, DEV)
    ids = [n["id"] for n in noted_client.get("/api/notifications").json()]
    assert ids == ["n1"]  # own team's bug only, not the INT-1 note or n3/n4


def test_admin_sees_every_note_except_ones_targeted_elsewhere(noted_client):
    ids = [n["id"] for n in noted_client.get("/api/notifications").json()]
    assert ids == ["n1", "n2", "n4"]  # n3 is addressed to u2 only
    assert [n["id"] for n in noted_client.get("/api/notifications").json()] == ids


def test_qa_sees_the_note_addressed_to_them(noted_client):
    as_user(noted_client, QA)
    assert "n3" in [n["id"] for n in noted_client.get("/api/notifications").json()]


def test_read_all_does_not_reveal_hidden_notes(noted_client):
    as_user(noted_client, DEV)
    ids = [n["id"] for n in noted_client.post("/api/notifications/read-all").json()]
    assert ids == ["n1"]


def test_bootstrap_notifications_are_scoped(noted_client):
    as_user(noted_client, DEV)
    body = noted_client.get("/api/bootstrap").json()
    assert [n["id"] for n in body["notifications"]] == ["n1"]


def test_activity_feed_is_unrestricted_roles_only(noted_client):
    as_user(noted_client, DEV)
    # No bug reference on activity rows, so developers get nothing rather than
    # a company-wide feed naming bugs they cannot open.
    assert noted_client.get("/api/bootstrap").json()["recentActivity"] == []

    as_user(noted_client, QA)
    assert len(noted_client.get("/api/bootstrap").json()["recentActivity"]) == 2
