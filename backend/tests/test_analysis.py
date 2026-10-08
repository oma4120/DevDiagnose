"""AI analysis endpoint: success bookkeeping, cost guards and failure modes.

`run_analysis` (the Groq call) is stubbed, so these tests prove everything the
API does around it: who may trigger it, what gets stored, the cooldown and the
per-bug cap that bound spend and document growth.
"""

import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.deps import get_current_user
from app.routers import bugs as bugs_router
from app.services.groq import GroqAnalyzerError
from tests.fakes import FakeStore, build_app, sign_in_as

DEV = {"id": "u3", "name": "Lina Dev", "email": "dev@n.dev", "role": "Developer", "status": "Active"}
OUTSIDER = {"id": "u9", "name": "No Access", "email": "out@n.dev", "role": "Developer", "status": "Active"}

PROJECT = {"id": "p1", "name": "Payments", "description": "checkout", "memberIds": ["u1", "u3"], "environments": {}}

BUG = {
    "id": "b1",
    "ref": "#1041",
    "title": "Card declines",
    "description": "Card declines at checkout for Visa cards",
    "projectId": "p1",
    "status": "In Progress",
    "severity": "High",
    "priority": "Medium",
    "category": "Backend",
    "reporterId": "u3",
    "assigneeIds": ["u3"],
    "stepsToReproduce": ["add card", "pay"],
    "expectedResult": "order created",
    "actualResult": "500",
    "environment": "prod",
    "browserDevice": "",
    "createdAt": "2026-01-01T00:00:00",
    "updatedAt": "2026-01-01T00:00:00",
    "evidence": [
        {
            "id": "e1",
            "type": "Screenshot",
            "title": "console.png",
            "content": "data:image/png;base64,AAAA",
            "language": None,
            "addedBy": "u3",
            "addedAt": "2026-01-01T00:00:00",
            "fileUrl": "data:image/png;base64,AAAA",
            "metadata": {},
        }
    ],
    "comments": [],
    "analyses": [],
    "timeline": [],
    "validatorId": None,
    "needsAttention": False,
    "resolvedBy": None,
    "resolvedAt": None,
}

RAW_ANALYSIS = {
    "rootCause": "Missing null check on the discount object",
    "explanation": "The checkout handler dereferences discount.percent when a promo is expired.",
    "confidence": 88,
    "classification": "Logic",
    "suggestedFix": {
        "summary": "Guard the discount lookup",
        "steps": ["Check discount existence", "Fall back to full price"],
        "code": "if not discount: return full_price",
    },
    "recommendedTests": ["expired promo returns 200 with full price"],
}


@pytest.fixture
def store():
    return FakeStore(projects=[PROJECT], bugs=[BUG], members=[DEV, OUTSIDER])


@pytest.fixture
def client(store, monkeypatch):
    monkeypatch.setattr(bugs_router, "get_store", lambda: store)
    # Module-level cooldown map must not leak between tests.
    monkeypatch.setattr(bugs_router, "_LAST_ANALYSIS", {})
    # Never call Groq: .env may hold a live paid API key. Tests that care about
    # the failure path re-stub this with their own raising double.
    monkeypatch.setattr(bugs_router, "run_analysis", lambda *a, **k: dict(RAW_ANALYSIS))
    app = build_app(bugs_router.router)
    sign_in_as(app, DEV)
    return TestClient(app)


@pytest.fixture
def no_cooldown(monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "analyze_cooldown_seconds", 0)


def analyze(client, bug_id="b1"):
    return client.post(f"/api/bugs/{bug_id}/analyze")


# --- success ----------------------------------------------------------------

def test_analysis_records_version_timeline_comment_and_notification(client, store, no_cooldown):
    res = analyze(client)
    assert res.status_code == 200
    body = res.json()

    # One stored analysis, versioned from scratch.
    assert len(body["bug"]["analyses"]) == 1
    analysis = body["bug"]["analyses"][0]
    assert analysis["version"] == 1
    assert analysis["rootCause"] == RAW_ANALYSIS["rootCause"]
    assert analysis["suggestedFix"]["steps"]

    # Auditable: timeline entry + AI comment + notification.
    assert body["bug"]["timeline"][-1]["kind"] == "ai"
    assert body["bug"]["timeline"][-1]["actor"] == "DevDiagnose AI"
    assert body["bug"]["comments"][-1]["authorKind"] == "AI"
    notes = [n for n in store.find_all("notifications") if n["category"] == "AI"]
    assert len(notes) == 1

    # The endpoint also returns the analysis at the top level for the client.
    assert body["analysis"]["rootCause"] == RAW_ANALYSIS["rootCause"]


def test_model_never_sees_screenshots(client, no_cooldown):
    analysis = analyze(client).json()["analysis"]
    assert analysis["inputContext"]["evidence"] == []
    # Screenshot titles may still be listed as considered evidence...
    assert "console.png" not in analysis["inputContext"]["evidence"]


def test_analysis_uses_the_project_context(client, no_cooldown):
    context = analyze(client).json()["analysis"]["inputContext"]
    assert context["project"]["name"] == "Payments"


# --- guards -----------------------------------------------------------------

def test_second_analysis_within_the_cooldown_is_throttled(client, monkeypatch, store):
    settings = get_settings()
    monkeypatch.setattr(settings, "analyze_cooldown_seconds", 30)

    assert analyze(client).status_code == 200
    second = analyze(client)
    assert second.status_code == 429
    assert "Try again in" in second.json()["detail"]
    # The throttled call must not have stored anything extra.
    assert len(store.find_one("bugs", "b1")["analyses"]) == 1


def test_cooldown_is_per_user_not_global(client, store, monkeypatch):
    settings = get_settings()
    monkeypatch.setattr(settings, "analyze_cooldown_seconds", 30)
    assert analyze(client).status_code == 200

    sign_in_as(client.app, {"id": "u5", "name": "Other Dev", "email": "o@n.dev", "role": "Developer", "status": "Active"})
    # Different user, same bug: not blocked by DEV's cooldown (they just need
    # visibility, which this user gets by being the fixture's project team...).
    store.patch("projects", "p1", {"memberIds": ["u1", "u3", "u5"]})
    assert analyze(client).status_code == 200


def test_analyses_per_bug_are_capped(client, store, no_cooldown, monkeypatch):
    monkeypatch.setattr(get_settings(), "max_analyses_per_bug", 1)
    assert analyze(client).status_code == 200
    assert analyze(client).status_code == 200

    bug = store.find_one("bugs", "b1")
    # Trims to the cap but version numbers keep counting up.
    assert len(bug["analyses"]) == 1
    assert bug["analyses"][-1]["version"] == 2


# --- failures ---------------------------------------------------------------

def test_groq_failure_surfaces_as_503_and_stores_nothing(client, store, no_cooldown, monkeypatch):
    def boom(*args, **kwargs):
        raise GroqAnalyzerError("GROQ_API_KEY is not configured")

    monkeypatch.setattr(bugs_router, "run_analysis", boom)
    res = analyze(client)
    assert res.status_code == 503
    assert "GROQ_API_KEY" in res.json()["detail"]
    assert store.find_one("bugs", "b1")["analyses"] == []
    assert store.find_one("bugs", "b1")["timeline"] == []


def test_outsider_cannot_analyze_a_hidden_bug(client):
    sign_in_as(client.app, OUTSIDER)
    assert analyze(client).status_code == 404


def test_analyzing_an_unknown_bug_is_not_found(client, no_cooldown):
    assert analyze(client, "b404").status_code == 404
