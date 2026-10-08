"""Invitation flow: issue, validate, accept - including the failure cases.

Mail is stubbed (`send_invite_email`) because the developer `.env` configures a
real SMTP host; the invite link is returned by the API either way, which is the
same contract the frontend relies on.
"""

from datetime import datetime, timedelta, timezone

import pytest
from fastapi.testclient import TestClient

from app.auth import hash_password, verify_password
from app.deps import get_current_user
from app.invites import hash_invite_token
from app.routers import invites as invites_router
from app.routers import members as members_router
from tests.fakes import FakeStore, build_app, sign_in_as

ADMIN = {"id": "u1", "name": "Omar Admin", "email": "admin@example.com", "role": "Admin", "status": "Active"}
QA = {"id": "u2", "name": "Sara QA", "email": "qa@example.com", "role": "QA", "status": "Active"}

EXISTING_MEMBER = {
    "id": "u3",
    "name": "Lina Dev",
    "email": "lina@example.com",
    "role": "Developer",
    "status": "Active",
    "passwordHash": hash_password("Whatever1!"),
}


@pytest.fixture
def store():
    return FakeStore(members=[dict(EXISTING_MEMBER)])


@pytest.fixture
def client(store, monkeypatch):
    monkeypatch.setattr(members_router, "get_store", lambda: store)
    monkeypatch.setattr(invites_router, "get_store", lambda: store)
    monkeypatch.setattr("app.deps.get_store", lambda: store)
    # Never touch the network: .env may hold a live SMTP host.
    monkeypatch.setattr(members_router, "send_invite_email", lambda *a, **k: True)
    app = build_app(members_router.router, invites_router.router)
    sign_in_as(app, ADMIN)
    return TestClient(app)


def invite(client, email="newbie@example.com", role="Developer", first="New", last="Bee"):
    return client.post(
        "/api/members",
        json={"email": email, "role": role, "firstName": first, "lastName": last},
    )


def token_from_link(link: str) -> str:
    return link.rstrip("/").rsplit("/", 1)[-1]


# --- issuing ---------------------------------------------------------------

def test_admin_invite_creates_a_pending_invite_and_returns_the_link(client, store):
    res = invite(client)
    assert res.status_code == 201
    body = res.json()
    assert body["email"] == "newbie@example.com"
    assert body["emailSent"] is True
    assert "/invite/" in body["inviteLink"]
    assert body["expiresAt"]

    raw_token = token_from_link(body["inviteLink"])
    stored = store.find_one("invites", "inv1")
    assert stored["status"] == "pending"
    assert stored["tokenHash"] == hash_invite_token(raw_token)
    # Only the digest is stored: a DB leak cannot be used to accept invitations.
    assert raw_token not in str(stored)


def test_invite_link_uses_the_configured_app_url(client):
    body = invite(client).json()
    assert body["inviteLink"].startswith("http://localhost:5173/invite/")


def test_mail_failure_still_returns_the_link(client, monkeypatch):
    monkeypatch.setattr(members_router, "send_invite_email", lambda *a, **k: False)
    res = invite(client)
    assert res.status_code == 201
    assert res.json()["emailSent"] is False
    assert "/invite/" in res.json()["inviteLink"]


def test_only_an_admin_may_invite(client):
    sign_in_as(client.app, QA)
    assert invite(client).status_code == 403


def test_inviting_an_existing_member_conflicts(client):
    res = invite(client, email="lina@example.com")
    assert res.status_code == 409
    assert "already a member" in res.json()["detail"]


def test_inviting_the_same_address_twice_conflicts(client):
    assert invite(client).status_code == 201
    res = invite(client)
    assert res.status_code == 409
    assert "pending invitation" in res.json()["detail"]


def test_invite_rejects_a_malformed_email(client):
    assert invite(client, email="not-an-email").status_code == 422


def test_invite_rejects_an_unknown_role(client):
    res = invite(client, role="Boss")
    assert res.status_code == 422


# --- validating a link ------------------------------------------------------

def test_invite_status_returns_email_and_name(client, store):
    link = invite(client, first="Ada", last="Lovelace").json()["inviteLink"]
    res = client.get(f"/api/invites/{token_from_link(link)}")
    assert res.status_code == 200
    assert res.json() == {
        "valid": True,
        "email": "newbie@example.com",
        "expiresAt": store.find_one("invites", "inv1")["expiresAt"],
        "name": "Ada Lovelace",
    }


def test_unknown_token_is_not_found(client):
    assert client.get("/api/invites/does-not-exist-0123456789abcdef").status_code == 404


def test_expired_invite_is_gone(client, store):
    link = invite(client).json()["inviteLink"]
    token = token_from_link(link)
    store.patch(
        "invites",
        "inv1",
        {"expiresAt": (datetime.now(timezone.utc) - timedelta(hours=1)).isoformat()},
    )
    res = client.get(f"/api/invites/{token}")
    assert res.status_code == 410
    assert "expired" in res.json()["detail"].lower()


def test_invite_without_an_expiry_is_rejected(client, store):
    link = invite(client).json()["inviteLink"]
    store.patch("invites", "inv1", {"expiresAt": None})
    res = client.get(f"/api/invites/{token_from_link(link)}")
    assert res.status_code == 410
    assert "missing an expiry" in res.json()["detail"]


def test_used_invite_is_gone(client, store):
    link = invite(client).json()["inviteLink"]
    store.patch("invites", "inv1", {"status": "used"})
    assert client.get(f"/api/invites/{token_from_link(link)}").status_code == 410


# --- accepting --------------------------------------------------------------

def accept(client, token, password="Str0ng!Pass", first="Ada", last="Lovelace"):
    return client.post(
        "/api/invites/accept",
        json={"token": token, "firstName": first, "lastName": last, "password": password},
    )


def test_accept_creates_an_active_member_with_a_hashed_password(client, store):
    token = token_from_link(invite(client, role="QA").json()["inviteLink"])

    res = accept(client, token)
    assert res.status_code == 200
    assert res.json() == {"accepted": True, "email": "newbie@example.com"}

    member = store.find_one_by("members", "email", "newbie@example.com")
    assert member is not None
    assert member["status"] == "Active"
    assert member["role"] == "QA"
    assert member["name"] == "Ada Lovelace"
    assert member["passwordHash"] != "Str0ng!Pass"
    assert verify_password("Str0ng!Pass", member["passwordHash"])
    # The invite is consumed, not left pending.
    assert store.find_one("invites", "inv1")["status"] == "accepted"


def test_accepting_the_same_invite_twice_fails(client):
    token = token_from_link(invite(client).json()["inviteLink"])
    assert accept(client, token).status_code == 200

    second = accept(client, token)
    assert second.status_code == 410
    assert "already used" in second.json()["detail"]


def test_accepting_an_expired_invite_fails(client, store):
    token = token_from_link(invite(client).json()["inviteLink"])
    store.patch(
        "invites",
        "inv1",
        {"expiresAt": (datetime.now(timezone.utc) - timedelta(minutes=1)).isoformat()},
    )
    assert accept(client, token).status_code == 410


def test_accept_with_an_unknown_token_is_not_found(client):
    assert accept(client, "x" * 43).status_code == 404


def test_accept_for_an_email_that_already_has_an_account_is_gone(client, store):
    # Race: the invite was issued while the address had no account, and the
    # account appeared before the link was opened (e.g. a second invite path).
    token = "r" * 43
    store.insert(
        "invites",
        {
            "id": "inv1",
            "tokenHash": hash_invite_token(token),
            "email": "lina@example.com",
            "role": "Developer",
            "firstName": "Lina",
            "lastName": "Dev",
            "status": "pending",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "expiresAt": (datetime.now(timezone.utc) + timedelta(hours=1)).isoformat(),
        },
    )
    res = accept(client, token)
    assert res.status_code == 410
    assert "already exists" in res.json()["detail"]
    assert store.find_one_by("members", "email", "lina@example.com")["id"] == "u3"


def test_accept_enforces_the_password_policy(client):
    token = token_from_link(invite(client).json()["inviteLink"])
    assert accept(client, token, password="short").status_code == 422
    assert accept(client, token, password="alllowercase").status_code == 422


# --- member management ------------------------------------------------------

def test_non_admin_cannot_list_or_delete_members(client):
    sign_in_as(client.app, QA)
    assert client.get("/api/members").status_code == 403
    assert client.delete("/api/members/u3").status_code == 403


def test_protected_admin_cannot_be_deleted(client, store):
    store.collections["members"].append({**ADMIN, "protected": True})
    res = client.delete("/api/members/u1")
    assert res.status_code == 409
    assert "protected" in res.json()["detail"]


def test_deleting_a_member_removes_it_from_the_store(client, store):
    res = client.delete("/api/members/u3")
    assert res.status_code == 200
    assert store.find_one("members", "u3") is None
