import re
from uuid import uuid4

from pydantic import ConfigDict, Field, field_validator

from app.types import (
    AIAnalysis,
    Base,
    Bug,
    BugStatus,
    Category,
    Comment,
    Evidence,
    EvidenceType,
    MemberRole,
    Priority,
    Project,
    Severity,
    SuggestedFix,
)


# --- input rules (mirrored in the frontend so users see errors inline) -----
EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[A-Za-z]{2,}$")
URL_RE = re.compile(r"^https?://\S+$", re.IGNORECASE)
MAX_DESCRIPTION = 20_000
MAX_DATA_URL = 1_500_000  # ~1.5 MB for pasted/attached image evidence


def _text(value: str, label: str, minimum: int = 1, maximum: int | None = None) -> str:
    """Trim `value` and enforce the length rule the UI documents."""
    text = value.strip()
    unit = "character" if minimum == 1 else "characters"
    if len(text) < minimum:
        raise ValueError(f"{label} must be at least {minimum} {unit}")
    if maximum is not None and len(text) > maximum:
        raise ValueError(f"{label} must be at most {maximum} characters")
    return text


def _email(value: str) -> str:
    email = value.strip().lower()
    if not EMAIL_RE.match(email):
        raise ValueError("Enter a valid email address (e.g. name@company.com)")
    return email


def _url(value: str | None, label: str) -> str | None:
    """Empty string clears the link; anything else must be http(s)."""
    if value is None:
        return None
    text = value.strip()
    if text and not URL_RE.match(text):
        raise ValueError(f"{label} must start with http:// or https://")
    return text


def _optional_text(value: str | None, label: str, maximum: int = 500) -> str | None:
    if value is None:
        return None
    return _text(value, label, minimum=0, maximum=maximum)


class ReqModel(Base):
    model_config = ConfigDict(use_enum_values=True)


class EvidenceIn(ReqModel):
    type: EvidenceType
    title: str = ""
    content: str = ""
    language: str | None = None
    fileUrl: str | None = None
    metadata: dict = Field(default_factory=dict)

    @field_validator("title", mode="after")
    @classmethod
    def _clean_title(cls, value: str) -> str:
        return _text(value, "Evidence title", minimum=0, maximum=120)

    @field_validator("content", mode="after")
    @classmethod
    def _clean_content(cls, value: str) -> str:
        if len(value) > MAX_DESCRIPTION:
            raise ValueError("Evidence content is too long")
        return value

    @field_validator("fileUrl", mode="after")
    @classmethod
    def _clean_file_url(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.startswith("data:image/"):
            raise ValueError("Attached images must be data:image/… URLs")
        if len(value) > MAX_DATA_URL:
            raise ValueError("Attached image is too large (max ~1.5 MB)")
        return value


class BugCreate(ReqModel):
    title: str
    description: str
    projectId: str = Field(min_length=1)
    severity: Severity = "Medium"
    priority: Priority = "Medium"
    category: Category = "Backend"
    stepsToReproduce: list[str] = []
    expectedResult: str = ""
    actualResult: str = ""
    environment: str = ""
    browserDevice: str = ""
    evidence: list[EvidenceIn] = []
    reporterId: str = "u1"
    assigneeIds: list[str] = []
    status: BugStatus = "Submitted"

    @field_validator("title", mode="after")
    @classmethod
    def _clean_title(cls, value: str) -> str:
        return _text(value, "Title", minimum=4, maximum=200)

    @field_validator("description", mode="after")
    @classmethod
    def _clean_description(cls, value: str) -> str:
        return _text(value, "Description", minimum=10, maximum=MAX_DESCRIPTION)

    @field_validator("stepsToReproduce", mode="after")
    @classmethod
    def _clean_steps(cls, value: list[str]) -> list[str]:
        steps = [str(s).strip() for s in value if str(s).strip()]
        if len(steps) > 50:
            raise ValueError("At most 50 reproduction steps")
        return steps

    @field_validator("expectedResult", "actualResult", "environment", "browserDevice", mode="after")
    @classmethod
    def _clean_fields(cls, value: str) -> str:
        return _text(value, "Field", minimum=0, maximum=2_000)


class CommentIn(ReqModel):
    authorKind: Comment.AuthorKind = "Developer"
    authorName: str = "Omar Haddad"
    body: str

    @field_validator("body", mode="after")
    @classmethod
    def _clean_body(cls, value: str) -> str:
        return _text(value, "Comment", minimum=1, maximum=5_000)

    @field_validator("authorName", mode="after")
    @classmethod
    def _clean_author(cls, value: str) -> str:
        return _text(value, "Author name", minimum=1, maximum=60)


class StatusUpdate(ReqModel):
    status: BugStatus


class AuthRequest(ReqModel):
    email: str
    password: str

    @field_validator("email", mode="after")
    @classmethod
    def _clean_email(cls, value: str) -> str:
        return _email(value)


class MemberCreate(ReqModel):
    """Admin invite-by-email: record an invitation (no member yet) and email a link."""

    email: str
    role: MemberRole = "Developer"
    firstName: str = ""
    lastName: str = ""

    @field_validator("email", mode="after")
    @classmethod
    def _clean_email(cls, value: str) -> str:
        return _email(value)

    @field_validator("firstName", "lastName", mode="after")
    @classmethod
    def _clean_names(cls, value: str) -> str:
        return _text(value, "Name", minimum=0, maximum=60)


def _strong_password(value: str) -> str:
    """Password policy for new passwords (invite setup and change-password)."""
    if not re.search(r"[A-Z]", value):
        raise ValueError("Password needs at least one uppercase letter")
    if not re.search(r"\d", value):
        raise ValueError("Password needs at least one number")
    if not re.search(r"[^A-Za-z0-9]", value):
        raise ValueError("Password needs at least one symbol (e.g. !@#$)")
    return value


class InviteAccept(ReqModel):
    token: str = Field(min_length=24)
    firstName: str = Field(min_length=1)
    lastName: str = Field(min_length=1)
    password: str = Field(min_length=8)

    @field_validator("firstName", "lastName", mode="after")
    @classmethod
    def _clean_names(cls, value: str) -> str:
        return _text(value, "Name", minimum=1, maximum=60)

    @field_validator("password")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        return _strong_password(value)


class PasswordChange(ReqModel):
    """Signed-in user replaces their password after confirming the current one."""

    currentPassword: str = Field(min_length=1)
    newPassword: str = Field(min_length=8)

    @field_validator("newPassword")
    @classmethod
    def _password_strength(cls, value: str) -> str:
        return _strong_password(value)


class ProjectMemberAdd(ReqModel):
    """Admin adds an already-registered employee to a project team."""

    memberId: str = Field(min_length=1)


class BugPatch(ReqModel):
    status: BugStatus | None = None
    severity: Severity | None = None
    priority: Priority | None = None
    assigneeIds: list[str] | None = None
    # Report content - editable after submitting (reporter/assignees/team/admin).
    title: str | None = None
    description: str | None = None
    category: Category | None = None
    stepsToReproduce: list[str] | None = None
    expectedResult: str | None = None
    actualResult: str | None = None
    environment: str | None = None
    browserDevice: str | None = None

    @field_validator("title", mode="after")
    @classmethod
    def _clean_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _text(value, "Title", minimum=4, maximum=200)

    @field_validator("description", mode="after")
    @classmethod
    def _clean_description(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _text(value, "Description", minimum=10, maximum=MAX_DESCRIPTION)

    @field_validator("expectedResult", "actualResult", "environment", "browserDevice", mode="after")
    @classmethod
    def _clean_fields(cls, value: str | None) -> str | None:
        return _optional_text(value, "Field", maximum=2_000)

    @field_validator("stepsToReproduce", mode="after")
    @classmethod
    def _clean_steps(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        steps = [str(s).strip() for s in value if str(s).strip()]
        if len(steps) > 50:
            raise ValueError("At most 50 reproduction steps")
        return steps


def _clean_business_rules(value: list[dict]) -> list[dict]:
    cleaned: list[dict] = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("Each business rule needs a title")
        title = str(item.get("title") or "").strip()
        if not title:
            raise ValueError("Each business rule needs a title")
        cleaned.append(
            {
                **item,
                "title": title,
                "description": str(item.get("description") or "").strip(),
            }
        )
    if len(cleaned) > 50:
        raise ValueError("At most 50 business rules")
    return cleaned


class ProjectCreate(ReqModel):
    name: str
    description: str = ""
    purpose: str = ""
    type: str = "Other"
    frontend: list[str] = []
    backend: list[str] = []
    database: list[str] = []
    services: list[str] = []
    auth: list[str] = []
    deployment: list[str] = []
    architecture: str = ""
    modules: list[str] = []
    apiPatterns: str = ""
    environments: dict = {}
    browsers: list[str] = []
    platforms: list[str] = []
    businessRules: list[dict] = []
    testingTools: list[str] = []
    conventions: str = ""
    constraints: str = ""
    repoUrl: str | None = None
    docsUrl: str | None = None
    memberIds: list[str] = []

    @field_validator("name", mode="after")
    @classmethod
    def _clean_name(cls, value: str) -> str:
        return _text(value, "Project name", minimum=2, maximum=80)

    @field_validator("description", "purpose", mode="after")
    @classmethod
    def _clean_long_text(cls, value: str) -> str:
        return _text(value, "Field", minimum=0, maximum=5_000)

    @field_validator("repoUrl", mode="after")
    @classmethod
    def _clean_repo(cls, value: str | None) -> str | None:
        return _url(value, "Repository URL")

    @field_validator("docsUrl", mode="after")
    @classmethod
    def _clean_docs(cls, value: str | None) -> str | None:
        return _url(value, "Docs URL")

    @field_validator("businessRules", mode="after")
    @classmethod
    def _clean_rules(cls, value: list[dict]) -> list[dict]:
        return _clean_business_rules(value)


class ProjectPatch(ReqModel):
    """Admin edit of project configuration - only fields present are applied."""

    name: str | None = None
    description: str | None = None
    purpose: str | None = None
    type: str | None = None
    frontend: list[str] | None = None
    backend: list[str] | None = None
    database: list[str] | None = None
    services: list[str] | None = None
    auth: list[str] | None = None
    deployment: list[str] | None = None
    architecture: str | None = None
    modules: list[str] | None = None
    apiPatterns: str | None = None
    environments: dict | None = None
    browsers: list[str] | None = None
    platforms: list[str] | None = None
    businessRules: list[dict] | None = None
    testingTools: list[str] | None = None
    conventions: str | None = None
    constraints: str | None = None
    repoUrl: str | None = None
    docsUrl: str | None = None
    memberIds: list[str] | None = None

    @field_validator("name", mode="after")
    @classmethod
    def _clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _text(value, "Project name", minimum=2, maximum=80)

    @field_validator("description", "purpose", mode="after")
    @classmethod
    def _clean_long_text(cls, value: str | None) -> str | None:
        return _optional_text(value, "Field", maximum=5_000)

    @field_validator("repoUrl", mode="after")
    @classmethod
    def _clean_repo(cls, value: str | None) -> str | None:
        return _url(value, "Repository URL")

    @field_validator("docsUrl", mode="after")
    @classmethod
    def _clean_docs(cls, value: str | None) -> str | None:
        return _url(value, "Docs URL")

    @field_validator("businessRules", mode="after")
    @classmethod
    def _clean_rules(cls, value: list[dict] | None) -> list[dict] | None:
        if value is None:
            return None
        return _clean_business_rules(value)


def build_analysis_doc(
    bug: Bug,
    raw: dict,
    version: int,
    context_version: str,
    input_context: dict,
) -> AIAnalysis:
    suggested_fix = raw.get("suggestedFix")
    if isinstance(suggested_fix, dict):
        fix = SuggestedFix(
            summary=str(suggested_fix.get("summary") or suggested_fix.get("text") or ""),
            steps=[str(s) for s in (suggested_fix.get("steps") or [])],
            code=suggested_fix.get("code"),
        )
    else:
        fix = SuggestedFix(summary=str(suggested_fix or ""), steps=[], code=None)

    uncertainty = raw.get("uncertainty")
    if isinstance(uncertainty, list):
        uncertainty = " ".join(str(u) for u in uncertainty) if uncertainty else None

    return AIAnalysis(
        id=f"a{uuid4().hex[:8]}",
        version=version,
        model=raw.get("model", "groq"),
        generatedAt=raw.get("generatedAt", "just now"),
        contextVersion=context_version,
        classification=raw.get("classification", "Unknown"),
        severityRec=raw.get("severityRec", bug.severity),
        priorityRec=raw.get("priorityRec", bug.priority),
        rootCause=raw.get("rootCause", ""),
        explanation=raw.get("explanation", ""),
        investigationSteps=raw.get("investigationSteps", []),
        suggestedFix=fix,
        recommendedTests=raw.get("recommendedTests", []),
        confidence=raw.get("confidence", 50),
        uncertainty=uncertainty,
        evidenceConsidered=[e.title or e.type for e in bug.evidence if e.type != "Screenshot"],
        reportRevision=bug.reportRevision,
        inputContext=input_context,
    )


def build_evidence_doc(e: EvidenceIn, added_by: str) -> Evidence:
    return Evidence(
        id=f"e{uuid4().hex[:8]}",
        type=e.type,
        title=e.title or e.type,
        content=e.content,
        language=e.language,
        addedBy=added_by,
        addedAt="just now",
        fileUrl=e.fileUrl,
        metadata=e.metadata,
    )


def allocate_id(prefix: str, existing_ids: list[str]) -> str:
    n = 1
    while f"{prefix}{n}" in existing_ids:
        n += 1
    return f"{prefix}{n}"


class CompanyUpdate(ReqModel):
    name: str | None = None
    workspace: str | None = None
    hasQA: bool | None = None
    logo: str | None = None  # data URL, or "" to clear

    @field_validator("name", mode="after")
    @classmethod
    def _clean_name(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _text(value, "Company name", minimum=2, maximum=80)

    @field_validator("workspace", mode="after")
    @classmethod
    def _clean_workspace(cls, value: str | None) -> str | None:
        if value is None:
            return None
        return _text(value, "Workspace", minimum=3, maximum=40)

    @field_validator("logo", mode="after")
    @classmethod
    def _clean_logo(cls, value: str | None) -> str | None:
        if value is None:
            return None
        logo = value.strip()
        if logo and not logo.startswith("data:image/"):
            raise ValueError("Logo must be an image data URL")
        if len(logo) > 2_000_000:
            raise ValueError("Logo is too large (max ~2 MB)")
        return logo