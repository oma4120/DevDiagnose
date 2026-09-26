import json
import re
from datetime import datetime

from groq import Groq

from app.config import get_settings


class GroqAnalyzerError(Exception):
    pass


def _now_label() -> str:
    return datetime.now().strftime("%b %d, %Y · %H:%M")


def _meaningful(text: str | None) -> bool:
    """A chunk of text carries real signal if it has a few words or some length."""
    text = (text or "").strip()
    return len(text.split()) >= 6 or len(text) >= 40


def has_actionable_content(bug: dict) -> bool:
    """True when the report carries concrete detail the model can work with.

    Mirrors exactly what build_context_prompt feeds the model (plus comments, which
    are also included in the prompt). Placeholder reports like title/description
    "test" must NOT qualify: diagnosing from them would be pure hallucination.
    """
    if _meaningful(bug.get("description")):
        return True
    if bug.get("stepsToReproduce"):
        return True
    if (bug.get("expectedResult") or "").strip() or (bug.get("actualResult") or "").strip():
        return True
    for e in bug.get("evidence") or []:
        # Screenshots are display-only and never reach the model.
        if e.get("type") != "Screenshot" and (e.get("content") or "").strip():
            return True
    # Details the reporter added after filing (the AI's own comments don't count).
    comment_text = " ".join(
        str(c.get("body") or "")
        for c in bug.get("comments") or []
        if c.get("authorKind") != "AI"
    )
    if _meaningful(comment_text):
        return True
    if len((bug.get("title") or "").split()) >= 12:
        return True
    return False


def insufficient_analysis(bug: dict, model: str) -> dict:
    """Honest answer for a report with no actionable content: ask for details
    instead of inventing a diagnosis."""
    return {
        "model": model,
        "classification": bug.get("category", "Unknown"),
        "severityRec": bug.get("severity", "Medium"),
        "priorityRec": bug.get("priority", "Medium"),
        "rootCause": "Insufficient information to diagnose",
        "explanation": (
            "This report does not contain enough detail to diagnose, so no root cause "
            "was guessed. The title and description look like placeholders and the bug "
            "has no reproduction steps, expected vs actual behavior, error output, or "
            "other evidence for an analysis to be based on. "
            "Add the missing details in a comment: (1) the exact steps to reproduce, "
            "(2) what you expected vs what actually happened, (3) any error message or "
            "console/log output, and (4) environment details - then re-run the analysis."
        ),
        "investigationSteps": [
            "Add the exact steps to reproduce the problem in a comment.",
            "Record the expected result and the actual result.",
            "Paste any error message, stack trace, or console/log output.",
            "Attach a screenshot or log excerpt as evidence.",
            "Re-run the AI analysis once the details are in the report.",
        ],
        "suggestedFix": {
            "summary": (
                "No fix can be recommended: the report has no actionable content, so any "
                "suggestion would be a guess. Complete the report first, then re-run the "
                "analysis."
            ),
            "steps": [
                "Add the missing details in a comment on this bug.",
                "Re-run the AI analysis.",
            ],
            "code": None,
        },
        "recommendedTests": [
            "Add a test that reproduces the issue once the reproduction steps are known.",
        ],
        "confidence": 5,
        "uncertainty": (
            "Analysis skipped: the report content is too thin to support any conclusion."
        ),
        "generatedAt": _now_label(),
    }


def build_context_prompt(bug: dict, project: dict) -> tuple[str, str]:
    """Returns (system, user) prompts, mirroring buildAgentPrompt in the frontend."""
    system = (
        "You are DevDiagnose AI, an expert software bug analysis engine and code reviewer. "
        "You analyze evidence, root causes, stack traces, server logs, and business context to "
        "deliver precise, actionable engineering reports.\n\n"
        "Never invent file paths, endpoints, code, or business rules that are not supported by "
        "the report or project context. If the report lacks concrete detail (no reproduction "
        "steps, no expected vs actual behavior, no error output, and only a vague description), "
        "do NOT guess a diagnosis: set rootCause to 'Insufficient information to diagnose', "
        "explain exactly which details are missing, make investigationSteps ask the reporter to "
        "supply them, keep confidence at 0-10, and leave suggestedFix.code null.\n\n"
        "Categorize each bug among: Backend, Frontend, Performance, Security, UI/UX, Regression, Database, Network."
    )

    parts: list[str] = [
        f"Bug: {bug['ref']} - {bug['title']}",
        f"Description: {bug.get('description') or 'N/A'}",
        f"Severity: {bug.get('severity')} · Priority: {bug.get('priority')} · Category: {bug.get('category')}",
        f"Status: {bug.get('status')}",
        f"Reproduce: {' → '.join(bug.get('stepsToReproduce') or []) or 'N/A'}",
        f"Expected: {bug.get('expectedResult') or 'N/A'}",
        f"Actual: {bug.get('actualResult') or 'N/A'}",
        f"Environment: {bug.get('environment') or 'N/A'}",
        f"Browser/Device: {bug.get('browserDevice') or 'N/A'}",
    ]
    if bug.get("evidence"):
        for e in bug["evidence"]:
            if e.get("type") == "Screenshot":
                continue  # display-only image: never sent to the model
            parts.append(f"[{e['type']}] {e.get('title', '')}:\n{e.get('content', '')}")

    comments = [c for c in bug.get("comments") or [] if c.get("authorKind") != "AI"]
    if comments:
        parts.append("--- Comments (details added after filing) ---")
        for c in comments:
            parts.append(f"{c.get('authorName', 'User')}: {c.get('body', '')}")

    parts.append("--- Project context ---")
    parts.append(f"Project: {project.get('name', 'N/A')}")
    parts.append(f"Purpose: {project.get('purpose') or 'N/A'}")
    if project.get("modules"):
        parts.append(f"Modules: {', '.join(project['modules'])}")
    if project.get("backend"):
        parts.append(f"Backend stack: {', '.join(project['backend'])}")
    if project.get("frontend"):
        parts.append(f"Frontend stack: {', '.join(project['frontend'])}")
    if project.get("constraints"):
        parts.append(f"Architectural constraints: {project.get('constraints')}")
    if project.get("businessRules"):
        for rule in project["businessRules"]:
            parts.append(f"Business rule ({rule.get('id')}): {rule.get('title')} - {rule.get('description')}")

    user = "\n".join(parts)
    return system, user


def run_analysis(bug: dict, project: dict) -> dict:
    """Calls Groq chat completions and returns a structured analysis dict.

    Raises GroqAnalyzerError if the API key is missing or the call fails.
    """
    settings = get_settings()

    # A placeholder report (e.g. title/description "test") gets an honest
    # "not enough information" answer instead of a hallucinated diagnosis -
    # answered locally, without calling the model.
    if not has_actionable_content(bug):
        return insufficient_analysis(bug, settings.groq_model or "none")

    if not settings.groq_api_key:
        raise GroqAnalyzerError(
            "GROQ_API_KEY is not set. Add it to backend/.env to enable AI analysis."
        )

    system, user = build_context_prompt(bug, project)

    schema_guide = json.dumps(
        {
            "model": "LLM family used (just the name)",
            "classification": "One category among the list",
            "severityRec": "Critical|High|Medium|Low",
            "priorityRec": "Urgent|High|Medium|Low",
            "rootCause": "The precise root cause, with file/function references from the evidence",
            "explanation": "A thorough explanation of why the bug occurs",
            "investigationSteps": ["ordered", "verification", "steps"],
            "suggestedFix": {
                "summary": "one-paragraph concrete fix recommendation with code-level detail",
                "steps": ["ordered", "implementation", "steps"],
                "code": "optional example fix code block (markdown string) or null",
            },
            "recommendedTests": ["test", "recommendations"],
            "confidence": 0,
            "uncertainty": "single sentence listing open questions and assumptions",
        },
        ensure_ascii=False,
    )

    client = Groq(api_key=settings.groq_api_key)
    try:
        completion = client.chat.completions.create(
            model=settings.groq_model,
            messages=[
                {"role": "system", "content": system},
                {"role": "user", "content": user},
                {
                    "role": "user",
                    "content": (
                        'Return ONLY a single JSON object (no markdown fences, no commentary) matching '
                        f'exactly this schema:\n{schema_guide}\n'
                        "confidence must be an integer 0-100. classification must be one of: "
                        "Backend, Frontend, Performance, Security, UI/UX, Regression, Database, Network."
                    ),
                },
            ],
            temperature=0.2,
            max_tokens=2800,
        )
    except Exception as exc:  # noqa: BLE001
        raise GroqAnalyzerError(f"Groq request failed: {exc}") from exc

    text = (completion.choices[0].message.content or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.MULTILINE).strip()
    text = text[text.find("{"): text.rfind("}") + 1]

    try:
        raw = json.loads(text)
    except json.JSONDecodeError as exc:
        raise GroqAnalyzerError("Groq returned unparseable JSON.") from exc

    raw.setdefault("model", settings.groq_model)
    raw["model"] = settings.groq_model
    raw.setdefault("classification", bug.get("category", "Unknown"))
    raw.setdefault("severityRec", bug.get("severity", "Medium"))
    raw.setdefault("priorityRec", bug.get("priority", "Medium"))
    raw.setdefault("rootCause", "")
    raw.setdefault("explanation", "")
    raw.setdefault("investigationSteps", [])
    raw.setdefault("suggestedFix", {"summary": "", "steps": [], "code": None})
    raw.setdefault("recommendedTests", [])
    raw.setdefault("uncertainty", "")
    try:
        raw["confidence"] = min(100, max(0, int(raw.get("confidence", 50))))
    except (TypeError, ValueError):
        raw["confidence"] = 50
    raw.setdefault("generatedAt", _now_label())
    return raw