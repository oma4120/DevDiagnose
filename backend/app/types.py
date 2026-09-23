"""Pydantic mirrors of the frontend TypeScript types (frontend/src/lib/types.ts).

Field names deliberately match the TS shapes (camelCase) so responses serialize
1:1 with what the React app expects.
"""

from enum import Enum
from typing import Literal

from pydantic import BaseModel, ConfigDict, Field


class Base(BaseModel):
    model_config = ConfigDict(use_enum_values=True)


class StrEnum(str, Enum):
    def __str__(self) -> str:
        return self.value


class MemberRole(StrEnum):
    developer = "Developer"
    qa = "QA"
    admin = "Admin"


class BugStatus(StrEnum):
    draft = "Draft"
    submitted = "Submitted"
    assigned = "Assigned"
    in_progress = "In Progress"
    qa_validation = "QA Validation"
    resolved = "Resolved"
    closed = "Closed"


class Severity(StrEnum):
    critical = "Critical"
    high = "High"
    medium = "Medium"
    low = "Low"


class Priority(StrEnum):
    urgent = "Urgent"
    high = "High"
    medium = "Medium"
    low = "Low"


class Category(StrEnum):
    backend = "Backend"
    frontend = "Frontend"
    performance = "Performance"
    security = "Security"
    ui = "UI/UX"
    regression = "Regression"
    database = "Database"
    network = "Network"


class EvidenceType(StrEnum):
    console = "Console Error"
    network = "Network Request"
    api = "API Response"
    stack = "Stack Trace"
    code = "Relevant Code"
    log = "Server Log"
    video = "Screen Recording"
    screenshot = "Screenshot"


class Member(Base):
    id: str
    name: str
    email: str
    role: MemberRole
    avatarColor: str
    status: str
    assignedBugs: int = 0
    resolvedBugs: int = 0
    lastActive: str = "—"
    # Stored in the DB but never serialized over the API.
    passwordHash: str | None = Field(default=None, exclude=True)


class BugAssignment(Base):
    """Current + historical developer assignments for a bug."""

    id: str
    bugId: str
    developerId: str
    assignedBy: str
    assignedAt: str
    unassignedAt: str | None = None
    status: Literal["active", "completed", "removed"]


class BusinessRule(Base):
    id: str
    title: str
    description: str


class EnvSpec(Base):
    development: str = ""
    staging: str = ""
    production: str = ""


class Project(Base):
    id: str
    name: str
    description: str = ""
    purpose: str = ""
    type: str
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
    businessRules: list[BusinessRule] = []
    testingTools: list[str] = []
    conventions: str = ""
    constraints: str = ""
    repoUrl: str | None = None
    docsUrl: str | None = None
    memberIds: list[str] = []
    openBugs: int = 0
    highSeverity: int = 0
    resolvedBugs: int = 0
    awaitingValidation: int = 0
    updatedAt: str = ""


class Evidence(Base):
    id: str
    type: EvidenceType
    title: str
    content: str
    language: str | None = None
    addedBy: str
    addedAt: str
    fileUrl: str | None = None
    metadata: dict = Field(default_factory=dict)


class Comment(Base):
    class AuthorKind(StrEnum):
        qa = "QA"
        developer = "Developer"
        ai = "AI"
        system = "System"

    id: str
    authorKind: AuthorKind
    authorName: str
    body: str
    at: str


class TimelineEntry(Base):
    id: str
    kind: Literal["created", "assigned", "ai", "comment", "status", "resolved"]
    label: str
    actor: str
    at: str


class SuggestedFix(Base):
    summary: str = ""
    steps: list[str] = Field(default_factory=list)
    code: str | None = None


class AIAnalysis(Base):
    id: str
    version: int
    model: str
    generatedAt: str
    contextVersion: str
    classification: str
    severityRec: str
    priorityRec: str
    rootCause: str
    explanation: str
    investigationSteps: list[str] = Field(default_factory=list)
    suggestedFix: SuggestedFix
    recommendedTests: list[str] = Field(default_factory=list)
    confidence: int
    uncertainty: str | None = None
    evidenceConsidered: list[str] = Field(default_factory=list)
    # Snapshot of the project/bug context + evidence the model actually saw.
    inputContext: dict = Field(default_factory=dict)


class Bug(Base):
    id: str
    ref: str
    title: str
    description: str
    projectId: str
    status: BugStatus
    severity: Severity
    priority: Priority
    category: Category
    reporterId: str
    assigneeIds: list[str] = []
    stepsToReproduce: list[str] = []
    expectedResult: str = ""
    actualResult: str = ""
    environment: str = ""
    browserDevice: str = ""
    createdAt: str
    updatedAt: str
    evidence: list[Evidence] = []
    comments: list[Comment] = []
    analyses: list[AIAnalysis] = []
    timeline: list[TimelineEntry] = []
    validatorId: str | None = None
    resolvedBy: str | None = None
    resolvedAt: str | None = None
    closedAt: str | None = None


class Notification(Base):
    id: str
    category: str
    message: str
    at: str
    read: bool
    bugRef: str | None = None


class Activity(Base):
    id: str
    message: str
    at: str