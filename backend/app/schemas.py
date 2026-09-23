from uuid import uuid4

from pydantic import ConfigDict, Field

from app.types import (
    AIAnalysis,
    Base,
    Bug,
    BugStatus,
    Category,
    Comment,
    Evidence,
    EvidenceType,
    Priority,
    Project,
    Severity,
    SuggestedFix,
)


class ReqModel(Base):
    model_config = ConfigDict(use_enum_values=True)


class EvidenceIn(ReqModel):
    type: EvidenceType
    title: str = ""
    content: str = ""
    language: str | None = None
    fileUrl: str | None = None
    metadata: dict = Field(default_factory=dict)


class BugCreate(ReqModel):
    title: str = Field(min_length=1)
    description: str = ""
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


class CommentIn(ReqModel):
    authorKind: Comment.AuthorKind = "Developer"
    authorName: str = "Omar Haddad"
    body: str = Field(min_length=1)


class StatusUpdate(ReqModel):
    status: BugStatus
    byUser: str | None = None


class AuthRequest(ReqModel):
    email: str
    password: str


class BugPatch(ReqModel):
    status: BugStatus | None = None
    severity: Severity | None = None
    priority: Priority | None = None


class ProjectCreate(ReqModel):
    name: str = Field(min_length=1)
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
        evidenceConsidered=[e.title or e.type for e in bug.evidence],
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