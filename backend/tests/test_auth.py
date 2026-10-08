"""Cookie-based authentication end to end, against the real dependency.

These use the actual `get_current_user` (no override), so they exercise the
HttpOnly cookie the way a browser would: login sets it, later requests carry
it, logout clears it, and a forged or expired value is rejected.
"""

import time

import jwt
import pytest
from fastapi.testclient import TestClient

from app.auth import AUTH_COOKIE_NAME, create_token, hash_password, verify_password
from app.config import get_settings
from app.deps import get_current_user
from app.routers import auth as auth_router
from app.routers import invites as invites_router
from tests.fakes import FakeStore, build_app

ADMIN_PASSWORD = "Sup3r!Secret1"
MEMBERS = [
    {
        "id": "u1",
        "name": "Omar Admin",
        "email": "admin@example.com",
        "role": "Admin",
        "status": "Active",
        "avatarColor": "#6366f1",
        "passwordHash": hash_password(ADMIN_PASSWORD),
    },
    {
        "id": "u5",
        "name": "Hind Invited",
        "email": "invited@example.com",
        "role": "Developer",
        "status": "Invited",
        "avatarColor": "#10b981",
        "passwordHash": hash_password("Whatever1!"),
    },
]


@pytest.fixture(autouse=True)
def _pin_app_url(monkeypatch):
    """Deterministic cookie `secure` flag regardless of the developer's .env."""
    settings = get_settings()
    previous = settings.app_url
    monkeypatch.setattr(settings, "app_url", "http://localhost:5173")
    yield
    monkeypatch.setattr(settings, "app_url", previous)


@pytest.fixture
def store():
    return FakeStore(members=MEMBERS)


@pytest.fixture
def client(store, monkeypatch):
    # The auth router and the real dependency both resolve the store by import.
    monkeypatch.setattr(auth_router, "get_store", lambda: store)
    monkeypatch.setattr("app.deps.get_store", lambda: store)
    app = build_app(auth_router.router, invites_router.router)
    return TestClient(app)


def login(client: TestClient, email: str = "admin@example.com", password: str = ADMIN_PASSWORD):
    return client.post("/api/auth/login", json={"email": email, "password": password})


# --- login -----------------------------------------------------------------

def test_login_success_sets_httponly_cookie_and_hides_the_token(client):
    res = login(client)
    assert res.status_code == 200

    set_cookie = res.headers["set-cookie"]
    lowered = set_cookie.lower()
    assert AUTH_COOKIE_NAME in set_cookie
    assert "httponly" in lowered, "cookie must not be readable from page JavaScript"
    assert "samesite=lax" in lowered
    assert "path=/" in lowered
    # http APP_URL -> not Secure (Secure would be dropped over plain http).
    assert "secure" not in lowered

    body = res.json()
    assert body["user"]["email"] == "admin@example.com"
    assert "passwordHash" not in body["user"]
    assert "token" not in body, "the JWT must only travel in the HttpOnly cookie"


def test_login_response_carries_a_signed_jwt_cookie(client):
    res = login(client)
    token = res.cookies[AUTH_COOKIE_NAME]
    # Three dot-separated segments = compact JWS, not an opaque random string.
    assert len(token.split(".")) == 3


def test_login_rejects_a_wrong_password(client):
    res = login(client, password="nope")
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid email or password"
    assert res.cookies.get(AUTH_COOKIE_NAME) is None


def test_login_rejects_an_unknown_email(client):
    res = login(client, email="ghost@example.com")
    assert res.status_code == 401


def test_login_rejects_an_invited_not_yet_active_account(client):
    res = login(client, email="invited@example.com", password="Whatever1!")
    assert res.status_code == 403
    assert "not active" in res.json()["detail"].lower()


def test_login_requires_both_credentials(client):
    # An empty/invalid email fails schema validation; an empty password reaches
    # authentication and fails there, without minting a session.
    assert login(client, email="").status_code == 422
    assert login(client, password="").status_code == 401
    assert client.cookies.get(AUTH_COOKIE_NAME) is None


# --- authenticated requests -------------------------------------------------

def test_cookie_authenticates_later_requests(client):
    assert login(client).status_code == 200
    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": ADMIN_PASSWORD, "newPassword": "EvenB3tter!Pass"},
    )
    assert res.status_code == 200
    assert res.json() == {"ok": True}


def test_change_password_then_login_with_the_new_password(client, store):
    login(client)
    client.post(
        "/api/auth/change-password",
        json={"currentPassword": ADMIN_PASSWORD, "newPassword": "EvenB3tter!Pass"},
    )
    stored = store.find_one("members", "u1")
    assert verify_password("EvenB3tter!Pass", stored["passwordHash"])
    assert not verify_password(ADMIN_PASSWORD, stored["passwordHash"])

    # A fresh client proves the credential itself changed, not just one session.
    fresh = TestClient(client.app)
    assert login(fresh, password="EvenB3tter!Pass").status_code == 200
    assert login(fresh, password=ADMIN_PASSWORD).status_code == 401


def test_change_password_rejects_a_wrong_current_password(client):
    login(client)
    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": "not-it", "newPassword": "Whatever1!"}
    )
    assert res.status_code == 400
    assert "incorrect" in res.json()["detail"].lower()


def test_protected_endpoint_without_a_cookie_is_401(client):
    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": ADMIN_PASSWORD, "newPassword": "Whatever1!"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Missing credentials"


def test_garbage_cookie_is_rejected(client):
    client.cookies.set(AUTH_COOKIE_NAME, "not.a.jwt")
    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": ADMIN_PASSWORD, "newPassword": "Whatever1!"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "Invalid or expired token"


def test_cookie_signed_with_the_wrong_secret_is_rejected(client):
    forged = jwt.encode({"sub": "u1", "exp": time.time() + 3600}, "attacker-secret", algorithm="HS256")
    client.cookies.set(AUTH_COOKIE_NAME, forged)
    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": ADMIN_PASSWORD, "newPassword": "Whatever1!"},
    )
    assert res.status_code == 401


def test_expired_cookie_is_rejected(client):
    settings = get_settings()
    expired = jwt.encode(
        {"sub": "u1", "exp": int(time.time()) - 60},
        settings.jwt_secret,
        algorithm="HS256",
    )
    client.cookies.set(AUTH_COOKIE_NAME, expired)
    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": ADMIN_PASSWORD, "newPassword": "Whatever1!"},
    )
    assert res.status_code == 401


def test_cookie_for_a_deleted_user_is_rejected(client):
    client.cookies.set(AUTH_COOKIE_NAME, create_token("u404"))
    res = client.post(
        "/api/auth/change-password",
        json={"currentPassword": ADMIN_PASSWORD, "newPassword": "Whatever1!"},
    )
    assert res.status_code == 401
    assert res.json()["detail"] == "User not found"


# --- logout -----------------------------------------------------------------

def test_logout_clears_the_cookie(client):
    assert login(client).status_code == 200

    res = client.post("/api/auth/logout")
    assert res.status_code == 200
    set_cookie = res.headers["set-cookie"].lower()
    assert AUTH_COOKIE_NAME in res.headers["set-cookie"]
    assert "max-age=0" in set_cookie or "expires=" in set_cookie

    # And the cleared session really is dead.
    after = client.post(
        "/api/auth/change-password",
        json={"currentPassword": ADMIN_PASSWORD, "newPassword": "Whatever1!"},
    )
    assert after.status_code == 401


def test_logout_is_safe_without_a_session(client):
    assert client.post("/api/auth/logout").status_code == 200


# --- dependency contract ----------------------------------------------------

def test_dependency_reads_the_cookie_header_name(client):
    """Guards the cookie name against drifting from the login endpoint."""
    assert get_current_user.__defaults__ is not None
    cookie_param = get_current_user.__defaults__[0]
    assert cookie_param.alias == AUTH_COOKIE_NAME
