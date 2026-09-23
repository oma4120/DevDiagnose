import json
import re
from datetime import datetime

from groq import Groq

from app.config import get_settings


class GroqAnalyzerError(Exception):
    pass


def _now_label() -> str:
    return datetime.now().strftime("%b %d, %Y · %H:%M")


def build_context_prompt(bug: dict, project: dict) -> tuple[str, str]:
    """Returns (system, user) prompts, mirroring buildAgentPrompt in the frontend."""
    system = (
        "You are DevDiagnose AI, an expert software bug analysis engine and code reviewer. "
        "You analyze evidence, root causes, stack traces, server logs, and business context to "
        "deliver precise, actionable engineering reports.\n\n"
        "Categorize each bug among: Backend, Frontend, Performance, Security, UI/UX, Regression, Database, Network."
    )

    parts: list[str] = [
        f"Bug: {bug['ref']} — {bug['title']}",
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
            parts.append(f"[{e['type']}] {e.get('title', '')}:\n{e.get('content', '')}")

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
            parts.append(f"Business rule ({rule.get('id')}): {rule.get('title')} — {rule.get('description')}")

    user = "\n".join(parts)
    return system, user


def run_analysis(bug: dict, project: dict) -> dict:
    """Calls Groq chat completions and returns a structured analysis dict.

    Raises GroqAnalyzerError if the API key is missing or the call fails.
    """
    settings = get_settings()
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
            max_tokens=1800,
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