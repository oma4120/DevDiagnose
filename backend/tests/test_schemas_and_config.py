"""Request validation and the config guards.

The rules asserted here are mirrored in frontend/src/lib/validation.ts, so a
change on one side should show up as a failure on the other.
"""

import pytest
from pydantic import ValidationError

from pathlib import Path

from app.config import Settings
from app.schemas import (
    BugCreate,
    BugPatch,
    CommentIn,
    CompanyUpdate,
    InviteAccept,
    MemberCreate,
    ProjectCreate,
)
from app.seed import DEMO_PASSWORD


# --- identity fields must not be client supplied ---------------------------

def test_bug_create_has_no_reporter_id():
    assert "reporterId" not in BugCreate.model_fields


def test_bug_create_has_no_status():
    # A status on the request body would let a caller skip the transition matrix.
    assert "status" not in BugCreate.model_fields


def test_bug_create_ignores_a_spoofed_reporter_and_status():
    bug = BugCreate(
        title="Login button does nothing",
        description="Clicking the sign in button on the login page does nothing at all.",
        projectId="p1",
        reporterId="u7",
        status="Closed",
    )
    assert not hasattr(bug, "reporterId")
    assert not hasattr(bug, "status")


def test_comment_only_accepts_a_body():
    assert set(CommentIn.model_fields) == {"body"}


def test_comment_ignores_a_forged_author():
    comment = CommentIn(body="looks fine to me", authorName="Omar Haddad", authorKind="AI")
    assert not hasattr(comment, "authorName")
    assert not hasattr(comment, "authorKind")


# --- length rules ---------------------------------------------------------

def test_bug_title_bounds():
    with pytest.raises(ValidationError):
        BugCreate(title="abc", description="a description long enough", projectId="p1")
    with pytest.raises(ValidationError):
        BugCreate(title="x" * 201, description="a description long enough", projectId="p1")


def test_bug_description_lower_bound():
    with pytest.raises(ValidationError):
        BugCreate(title="Valid title here", description="too short", projectId="p1")


def test_bug_create_accepts_a_minimal_valid_report():
    bug = BugCreate(title="Valid title here", description="a description long enough", projectId="p1")
    assert bug.severity == "Medium"
    assert bug.priority == "Medium"
    assert bug.assigneeIds == []


def test_at_most_fifty_reproduction_steps():
    BugPatch(stepsToReproduce=[f"step {i}" for i in range(50)])
    with pytest.raises(ValidationError):
        BugPatch(stepsToReproduce=[f"step {i}" for i in range(51)])


def test_comment_length_bounds():
    with pytest.raises(ValidationError):
        CommentIn(body="")
    with pytest.raises(ValidationError):
        CommentIn(body="x" * 5001)


def test_email_is_normalised_to_lowercase():
    assert MemberCreate(email="  Ahmad@Example.COM ").email == "ahmad@example.com"


def test_invalid_email_is_rejected():
    with pytest.raises(ValidationError):
        MemberCreate(email="not-an-email")


def test_urls_must_be_http_and_capped():
    with pytest.raises(ValidationError):
        ProjectCreate(name="Payments", repoUrl="ftp://example.com/repo")
    with pytest.raises(ValidationError):
        ProjectCreate(name="Payments", docsUrl="h" * 501)
    # Empty clears the link, matching the frontend form.
    assert ProjectCreate(name="Payments", repoUrl="").repoUrl == ""


def test_workspace_slug_shape():
    with pytest.raises(ValidationError):
        CompanyUpdate(workspace="Northwind Labs")
    assert CompanyUpdate(workspace="northwind-labs").workspace == "northwind-labs"


def test_logo_must_be_an_image_data_url():
    with pytest.raises(ValidationError):
        CompanyUpdate(logo="https://example.com/logo.png")


def test_logo_cap_is_two_million_characters():
    with pytest.raises(ValidationError):
        CompanyUpdate(logo="data:image/png;base64," + "A" * 2_000_001)


# --- password policy ------------------------------------------------------

def test_password_needs_uppercase_number_and_symbol():
    for weak in ("short1!", "alllower1!", "NoDigits!!", "NoSymbol12"):
        with pytest.raises(ValidationError):
            InviteAccept(token="t" * 32, firstName="A", lastName="B", password=weak)


def test_password_rule_mirrors_the_invite_form():
    # The form advertises exactly: 8+ chars, one uppercase, one number, one
    # symbol. Anything stricter here would reject passwords the UI accepts.
    InviteAccept(token="t" * 32, firstName="A", lastName="B", password="ALLUPPER1!")


def test_strong_password_is_accepted():
    accept = InviteAccept(token="t" * 32, firstName="Ada", lastName="L", password="Str0ng!Pass")
    assert accept.password == "Str0ng!Pass"


def test_business_rules_need_a_title():
    with pytest.raises(ValidationError):
        ProjectCreate(name="Payments", businessRules=[{"title": "  "}])


# --- settings guards ------------------------------------------------------

# conftest seeds these into the process so that importing any router works, and
# process values outrank anything passed to the constructor, so they are cleared
# before each scenario builds its own Settings.
_SETTING_ENV_KEYS = [
    "JWT_SECRET", "MONGODB_URI", "MONGO_URI", "SEED_DEMO_DATA",
    "BOOTSTRAP_ADMIN_EMAIL", "BOOTSTRAP_ADMIN_PASSWORD", "CORS_ORIGINS",
]


@pytest.fixture
def clean_env(monkeypatch):
    for key in _SETTING_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    return monkeypatch


def _settings(monkeypatch, **env):
    """Build Settings the way the app does: from environment variables.

    Init kwargs are not the same as env names (only mongo_uri declares an
    alias), so going through the environment also covers the naming rules.
    """
    for key in _SETTING_ENV_KEYS:
        monkeypatch.delenv(key, raising=False)
    monkeypatch.setenv("MONGODB_URI", "mongodb://localhost:27017")
    for key, value in env.items():
        monkeypatch.setenv(key, value)
    return Settings(_env_file=None)


def test_missing_jwt_secret_is_rejected(clean_env):
    with pytest.raises(ValidationError, match="JWT_SECRET is required"):
        Settings(_env_file=None)


def test_placeholder_jwt_secret_is_rejected(clean_env):
    with pytest.raises(ValidationError, match="placeholder"):
        _settings(clean_env, JWT_SECRET="dev-secret-change-me")


@pytest.mark.parametrize(
    "secret",
    [
        "CHANGE_ME_generate_a_random_secret",
        "changeme-please-1234",
        "your-secret-goes-here",
        "placeholder-secret-value",
        "example-jwt-secret-key",
    ],
)
def test_placeholder_shaped_secrets_are_rejected(clean_env, secret):
    # .env.example is public and gets edited and re-published, so the guard has
    # to catch placeholder *shapes*, not just one literal value.
    with pytest.raises(ValidationError, match="placeholder"):
        _settings(clean_env, JWT_SECRET=secret)


def test_the_shipped_env_example_is_not_usable_as_a_secret(clean_env):
    # Guards against a future .env.example edit quietly shipping a valid secret.
    example = (Path(__file__).resolve().parents[1] / ".env.example").read_text(encoding="utf-8")
    shipped = next(
        line.split("=", 1)[1].strip()
        for line in example.splitlines()
        if line.startswith("JWT_SECRET=")
    )
    with pytest.raises(ValidationError):
        _settings(clean_env, JWT_SECRET=shipped)


def test_short_jwt_secret_is_rejected(clean_env):
    with pytest.raises(ValidationError, match="at least 16"):
        _settings(clean_env, JWT_SECRET="tooshort")


def test_valid_secret_is_accepted(clean_env):
    assert _settings(clean_env, JWT_SECRET="x" * 40).jwt_secret == "x" * 40


def test_demo_seeding_is_off_by_default(clean_env):
    # A fresh production database must not come up with demo accounts.
    assert _settings(clean_env, JWT_SECRET="x" * 40).seed_demo_data is False


def test_demo_seeding_can_be_enabled_explicitly(clean_env):
    assert _settings(clean_env, JWT_SECRET="x" * 40, SEED_DEMO_DATA="true").seed_demo_data is True


def test_bootstrap_admin_requires_both_halves(clean_env):
    with pytest.raises(ValidationError, match="must be set together"):
        _settings(clean_env, JWT_SECRET="x" * 40, BOOTSTRAP_ADMIN_EMAIL="admin@example.com")
    with pytest.raises(ValidationError, match="must be set together"):
        _settings(clean_env, JWT_SECRET="x" * 40, BOOTSTRAP_ADMIN_PASSWORD="Str0ng!Pass")


def test_bootstrap_admin_pair_is_accepted(clean_env):
    settings = _settings(
        clean_env,
        JWT_SECRET="x" * 40,
        BOOTSTRAP_ADMIN_EMAIL="admin@example.com",
        BOOTSTRAP_ADMIN_PASSWORD="Str0ng!Pass",
    )
    assert settings.bootstrap_admin_email == "admin@example.com"


def test_cors_origins_are_split_and_trimmed(clean_env):
    origins = _settings(clean_env, JWT_SECRET="x" * 40, CORS_ORIGINS=" http://a.test , http://b.test ,").cors_origin_list
    assert origins == ["http://a.test", "http://b.test"]


def test_ai_limits_default_to_safe_values(clean_env):
    settings = _settings(clean_env, JWT_SECRET="x" * 40)
    assert settings.analyze_cooldown_seconds > 0
    assert settings.max_analyses_per_bug > 0


def test_demo_password_lives_with_the_seed_data():
    # It must never be reachable as a general auth constant again.
    from app import auth

    assert not hasattr(auth, "DEMO_PASSWORD")
    assert DEMO_PASSWORD == "demo1234"
