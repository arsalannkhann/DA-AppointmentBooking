from __future__ import annotations
"""
Intent Analyzer — Clinical Orchestration & Triage
Semantic clinical extraction with strict safety guardrails, multi-condition support,
chat history context, and post-LLM safety validation.
"""
import re
import json
import logging
from dataclasses import dataclass, asdict, field
from typing import Optional, List, Dict, Any
from config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

# ── Valid values ────────────────────────────────────────────────────────────
VALID_URGENCIES = {"EMERGENCY", "HIGH", "MEDIUM", "LOW", None}

# ═══════════════════════════════════════════════════════════════════════════
#  Data Classes
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class ClinicalIssue:
    symptom_cluster: str          # e.g., "upper right tooth severe night pain"
    urgency: str                  # EMERGENCY | HIGH | MEDIUM | LOW
    reasoning: str                # Why this category/urgency?
    
    # Feature Flags (Deterministic Inputs)
    has_pain: bool = False
    severity: Optional[int] = None # 1-10
    duration_days: Optional[int] = None
    thermal_sensitivity: bool = False
    biting_pain: bool = False
    swelling: bool = False
    visible_swelling: bool = False
    airway_compromise: bool = False
    trauma: bool = False
    bleeding: bool = False
    impacted_wisdom: bool = False
    requires_sedation: bool = False
    
    # Metadata (Optional)
    location: Optional[str] = None          # e.g., "UR Q1", "LL Q3"
    reported_symptoms: List[str] = field(default_factory=list)
    suspected_category: Optional[str] = None # Deprecated, kept for logging
    
    # Clinical Gate Fields (New)
    clinical_profile: dict = field(default_factory=dict) # e.g. {"location": True, "duration": False}
    missing_clinical_elements: List[str] = field(default_factory=list)
    missing_fields: List[dict] = field(default_factory=list) # Dynamic UI Requirements
    # Explicit structured field answers keyed by field_key.
    field_answers: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self):
        return asdict(self)

@dataclass
class IntentResult:
    issues: List[ClinicalIssue] = field(default_factory=list)
    overall_urgency: Optional[str] = None
    requires_clarification: bool = False
    clarification_questions: List[str] = field(default_factory=list)
    safety_flag: bool = False
    action_type: str = "UNKNOWN"  # CLARIFY, ROUTE, ESCALATE, GREETING, SMALL_TALK, UNKNOWN
    patient_sentiment: str = "Neutral"  # Anxious | Neutral | Frustrated
    completion_status: str = "INCOMPLETE"  # COMPLETE | INCOMPLETE

    def to_dict(self):
        return asdict(self)


# ═══════════════════════════════════════════════════════════════════════════
#  Deterministic Pattern Matching (Tier 0–1)
# ═══════════════════════════════════════════════════════════════════════════

_GREETING_PATTERNS = [
    r"^(hi|hii+|hey|hello|hola|yo|sup|hiya|howdy|greetings|good\s*(morning|afternoon|evening|day|night))[\s!?.]*$",
    r"^(what'?s?\s*up|how\s*are\s*you|how'?s?\s*it\s*going)[\s!?.]*$",
    r"^(thanks|thank\s*you|ty|thx|cheers)[\s!?.]*$",
    r"^(bye|goodbye|see\s*you|later|cya|take\s*care)[\s!?.]*$",
    r"^(ok|okay|sure|alright|fine|cool|great|nice|awesome|got\s*it|understood)[\s!?.]*$",
    r"^(yes|no|yep|nope|yeah|nah|yup)[\s!?.]*$",
]

_SMALL_TALK_PATTERNS = [
    r"^(who\s*are\s*you|what\s*can\s*you\s*do|what\s*is\s*this|help)[\s!?.]*$",
    r"^(tell\s*me\s*(about|more)|what\s*services)[\s!?.]*$",
    r"^(can\s*you\s*help|i\s*need\s*help)[\s!?.]*$",
]

_RED_FLAGS = [
    r"(?:^|[^\w])(?:can'?t|cannot|unable to)\s+breathe",
    r"(?:^|[^\w])(?:difficulty|trouble)\s+breathing",
    r"uncontrollable?\s+bleed",
    r"swelling.{0,20}(eye|throat|neck|airway)",
    r"severe\s+trauma",
    r"jaw\s+(fracture|broken)",
    r"(anaphyla|allergic\s+reaction)",
    r"chest\s+pain",
    r"loss\s+of\s+consciousness",
    r"(?:^|[^\w])(?:can'?t|cannot|unable to)\s+swallow",
    r"(?<!no\s)(?<!without\s)(?:difficulty|trouble)\s+swallowing",
    r"(knocked?\s*(out|off)|avulsed)\s*(tooth|teeth)",
    r"(tooth|teeth)\s*(knocked?\s*(out|off)|avulsed)",
    r"heavy\s+bleeding.{0,20}(tooth|gum|mouth)",
    # Removed "pain 9/10" regex as requested - defer to LLM high urgency
]

_CLARIFICATION_DEFAULTS = [
    "Could you describe your symptoms in more detail?",
    "Where exactly is the pain or problem located?",
    "On a scale of 1-10, how severe is the pain?",
    "Are you experiencing any swelling or bleeding?",
]

_STRUCTURED_META_KEYS = {"issues", "answers", "field_submission", "pendingStructuredData"}


def _parse_duration_days(value: Any) -> Optional[int]:
    if value is None:
        return None
    if isinstance(value, (int, float)):
        return int(value)
    text = str(value).strip().lower()
    if not text:
        return None
    if "less than 24" in text or "today" in text:
        return 1
    if "1-3" in text:
        return 2
    if "4-7" in text:
        return 5
    if "1-2 week" in text:
        return 10
    if "more than 2 week" in text or "months" in text:
        return 21
    if "seconds" in text:
        return 1
    if "minutes" in text:
        return 1
    if "hours" in text:
        return 1
    nums = re.findall(r"\d+", text)
    return int(nums[0]) if nums else None


def _normalize_structured_answers(structured_data: Optional[dict]) -> Dict[str, Any]:
    if not structured_data:
        return {}

    answers: Dict[str, Any] = {}
    nested = structured_data.get("answers") if isinstance(structured_data, dict) else None
    if isinstance(nested, dict):
        answers.update(nested)

    field_submission = structured_data.get("field_submission") if isinstance(structured_data, dict) else None
    if isinstance(field_submission, dict):
        answers.update(field_submission)

    if isinstance(structured_data, dict):
        for key, value in structured_data.items():
            if key in _STRUCTURED_META_KEYS:
                continue
            answers[key] = value

    return answers


def _apply_structured_answers_to_issue(issue: "ClinicalIssue", answers: Dict[str, Any]) -> None:
    if not answers:
        return

    for raw_key, raw_value in answers.items():
        key = (raw_key or "").strip().lower()
        value = raw_value
        value_text = ""
        if isinstance(value, list):
            value_text = ", ".join(str(v) for v in value if v is not None)
        elif value is not None:
            value_text = str(value)

        if value is not None and key:
            issue.field_answers[key] = value

        if key in {"location", "pain_location"} and value_text:
            issue.location = value_text
        elif key in {"pain_severity", "severity"}:
            try:
                issue.severity = int(value) if value is not None else issue.severity
                issue.has_pain = True
            except (TypeError, ValueError):
                pass
        elif key in {"duration", "duration_days", "symptom_duration"}:
            parsed_days = _parse_duration_days(value)
            if parsed_days is not None:
                issue.duration_days = parsed_days
            if value_text:
                issue.reported_symptoms.append(value_text)
        elif key == "thermal_duration" and value_text:
            issue.thermal_sensitivity = True
            issue.reported_symptoms.append(value_text)
        elif key == "stimulus":
            issue.has_pain = True
            lowered = value_text.lower()
            if any(token in lowered for token in ["hot", "cold", "thermal"]):
                issue.thermal_sensitivity = True
            if any(token in lowered for token in ["chew", "biting", "pressure"]):
                issue.biting_pain = True
            if value_text:
                issue.reported_symptoms.append(value_text)
        elif key == "swelling_location":
            lowered = value_text.lower()
            issue.swelling = True
            if any(token in lowered for token in ["face", "cheek", "jaw", "neck", "floor"]):
                issue.visible_swelling = True
            if value_text:
                issue.reported_symptoms.append(value_text)
        elif key == "trismus_status" and value_text:
            issue.reported_symptoms.append(value_text)
        elif key == "airway_status":
            lowered = value_text.lower()
            if any(token in lowered for token in ["difficulty breathing", "unable", "can’t breathe", "can't breathe"]):
                issue.airway_compromise = True
            if value_text:
                issue.reported_symptoms.append(value_text)
        elif key == "hemorrhage_status":
            lowered = value_text.lower()
            if any(token in lowered for token in ["uncontrolled", "heavy", "fills mouth"]):
                issue.bleeding = True
            if value_text:
                issue.reported_symptoms.append(value_text)
        elif key in {"previous_intervention", "analgesic_status", "chronobiology", "post_op_status", "systemic_risk", "imaging_availability", "nature_of_problem", "last_visit"} and value_text:
            issue.reported_symptoms.append(value_text)
        elif value_text:
            issue.reported_symptoms.append(value_text)

    # Deduplicate and clean
    deduped: List[str] = []
    for symptom in issue.reported_symptoms:
        s = (symptom or "").strip()
        if s and s not in deduped:
            deduped.append(s)
    issue.reported_symptoms = deduped


# ═══════════════════════════════════════════════════════════════════════════
#  Post-LLM Safety Validation
# ═══════════════════════════════════════════════════════════════════════════

_FORBIDDEN_PATTERNS = [
    r"you\s+have\s+(pulpitis|periodontitis|abscess|gingivitis|caries|cavity|infection)",
    r"diagnosis\s+is",
    r"diagnosed\s+with",
    r"you\s+(need|require|should\s+get)\s+(a\s+)?(root\s+canal|extraction|filling|crown|implant|bridge)",
    r"take\s+(amoxicillin|ibuprofen|antibiotics|painkillers|acetaminophen|tylenol|advil)",
    r"prescribe",
    r"prescription",
    r"i\s+recommend\s+(taking|using)",
]


def _validate_safety(raw_text: str) -> bool:
    """
    Post-LLM safety scanner. Returns True if the output is SAFE.
    Returns False if forbidden diagnosis/prescription patterns are detected.
    """
    lower = raw_text.lower()
    for pattern in _FORBIDDEN_PATTERNS:
        if re.search(pattern, lower):
            logger.warning(f"SAFETY VIOLATION detected in LLM output: pattern='{pattern}'")
            return False
    return True


# ═══════════════════════════════════════════════════════════════════════════
#  System Prompt — Dental Triage Orchestrator (Feature-First)
# ═══════════════════════════════════════════════════════════════════════════

_SYSTEM_PROMPT = """You are a clinical feature extractor for dental intake.

Rules:
1. Extract structured features only.
2. Never diagnose, prescribe, or recommend treatment.
3. Do not decide final routing or completion status.
4. Do not escalate unless airway compromise or uncontrolled bleeding is explicitly present.
5. Merge with conversational context and keep outputs factual.

Return JSON only in this shape:
{
  "issues": [
    {
      "symptom_cluster": "string",
      "urgency": "HIGH | MEDIUM | LOW",
      "reasoning": "short factual extraction summary",
      "has_pain": boolean,
      "severity": int | null,
      "duration_days": int | null,
      "thermal_sensitivity": boolean,
      "biting_pain": boolean,
      "swelling": boolean,
      "visible_swelling": boolean,
      "airway_compromise": boolean,
      "trauma": boolean,
      "bleeding": boolean,
      "impacted_wisdom": boolean,
      "location": "string | null",
      "reported_symptoms": ["string"]
    }
  ],
  "patient_sentiment": "Neutral | Anxious | Frustrated"
}
"""


# ═══════════════════════════════════════════════════════════════════════════
#  Main Analysis Pipeline
# ═══════════════════════════════════════════════════════════════════════════

def analyze_intent(text: str, history: Optional[list[dict]] = None, structured_data: Optional[dict] = None) -> IntentResult:
    """
    Orchestration-ready intent analysis with Deterministic State Merging.
    1. Deterministic checks (Greetings, Red Flags).
    2. Structured Data Ingestion (Tier 0.5)
    3. LLM Extraction (Multi-condition, with chat history).
    4. Deterministic State Merge (Tier 3.5).
    5. Post-LLM Safety Validation (Sanitization).
    6. Clarification Loop Prevention.
    7. Fallback/Validation.
    """
    stripped = (text or "").strip()
    lower = stripped.lower()

    previous_issues: List[ClinicalIssue] = []
    if structured_data and "issues" in structured_data:
        for i_data in structured_data["issues"]:
            try:
                previous_issues.append(ClinicalIssue(**i_data))
            except Exception:
                continue
    structured_answers = _normalize_structured_answers(structured_data)

    # ── Tier 0: Empty Input ─────────────────────────────────────────
    if len(stripped) < 1 and not (previous_issues or structured_answers):
        return IntentResult(
            requires_clarification=True,
            clarification_questions=["Please describe your dental concern so I can assist you."],
            action_type="UNKNOWN"
        )

    # Structured clarification update: no new free text, only key/value updates.
    if len(stripped) < 1 and (previous_issues or structured_answers):
        merged_issues = previous_issues
        if not merged_issues:
            seed_text = "Structured clarification update"
            if history:
                last_user = next((m for m in reversed(history) if m.get("role") == "user" and m.get("content")), None)
                if last_user:
                    seed_text = str(last_user.get("content"))
            merged_issues = [
                ClinicalIssue(
                    symptom_cluster=seed_text,
                    urgency="MEDIUM",
                    reasoning="Structured clarification update",
                )
            ]

        if structured_answers:
            for issue in merged_issues:
                _apply_structured_answers_to_issue(issue, structured_answers)

        has_confirmed_danger = any(
            issue.airway_compromise or issue.bleeding
            for issue in merged_issues
        )
        if has_confirmed_danger:
            return IntentResult(
                issues=merged_issues,
                overall_urgency="EMERGENCY",
                action_type="ESCALATE",
                completion_status="INCOMPLETE",
                clarification_questions=[],
                safety_flag=True,
                requires_clarification=False,
            )

        # Deterministic gate on merged state.
        if merged_issues and all(_backend_completion_check(issue) for issue in merged_issues):
            return IntentResult(
                issues=merged_issues,
                overall_urgency=max((issue.urgency for issue in merged_issues if issue.urgency), default="LOW"),
                action_type="ROUTE",
                completion_status="COMPLETE",
                clarification_questions=[],
            )

        return IntentResult(
            issues=merged_issues,
            overall_urgency=max((issue.urgency for issue in merged_issues if issue.urgency), default="LOW"),
            action_type="CLARIFY",
            completion_status="INCOMPLETE",
            clarification_questions=_deterministic_questions(merged_issues),
            requires_clarification=True,
        )

    # ── Tier 1: Deterministic Red Flags (Safety First) ──────────────
    for pat in _RED_FLAGS:
        if re.search(pat, lower):
            return IntentResult(
                overall_urgency="EMERGENCY",
                safety_flag=True,
                action_type="ESCALATE", # Fixed from EMERGENCY
                issues=[
                    ClinicalIssue(
                        symptom_cluster=stripped,
                        suspected_category="Emergency",
                        urgency="EMERGENCY",
                        reasoning=f"Red flag detected via regex: {pat}"
                    )
                ]
            )

    # ── Tier 2: Deterministic Greeting / Small Talk ─────────────────
    if len(stripped.split()) < 10:
        for pat in _GREETING_PATTERNS:
            if re.match(pat, lower):
                return IntentResult(
                    action_type="GREETING",
                    issues=[]
                )
        for pat in _SMALL_TALK_PATTERNS:
            if re.match(pat, lower):
                return IntentResult(
                    action_type="SMALL_TALK",
                    issues=[]
                )

    # ── Tier 3: LLM Extraction ──────────────────────────────────────
    intent = _llm_analyze(stripped, history)

    if not intent:
        # Fallback
        return IntentResult(
            requires_clarification=True,
            clarification_questions=_CLARIFICATION_DEFAULTS,
            action_type="UNKNOWN",
            overall_urgency="LOW"
        )

    # ── Tier 3.5: Deterministic State Merge ─────────────────────────
    if previous_issues:
        intent.issues = _merge_with_previous_issues(intent.issues, previous_issues)
    if structured_answers:
        for issue in intent.issues:
            _apply_structured_answers_to_issue(issue, structured_answers)

    # ── Tier 3.6 Loop Prevention ────────────────────────────────────
    if history and intent.clarification_questions:
        last_bot = next((m for m in reversed(history) if m.get("role") == "assistant"), None)
        # Check if last bot questions match current questions
        # Note: history content is string, we need to check if it contains the questions
        # or if we passed structured Qs. 
        # Simple string equality of first Q:
        if last_bot and last_bot.get("content"):
             # If exact same questions repeated
             if any(q in last_bot["content"] for q in intent.clarification_questions):
                 logger.warning("Clarification Loop Detected. Keeping CLARIFY with deterministic gate.")
                 intent.clarification_questions = []

    # ── Tier 3.7: Reasoning Safety Sanitization ─────────────────────
    for issue in intent.issues:
        if not _validate_safety(issue.reasoning or ""):
            issue.reasoning = "Clinical routing criteria met."

    # ── Tier 4: Deterministic Action Gate (No LLM Routing) ──────────
    has_confirmed_danger = any(
        issue.airway_compromise or issue.bleeding
        for issue in intent.issues
    )
    if has_confirmed_danger:
        intent.action_type = "ESCALATE"
        intent.safety_flag = True
        intent.overall_urgency = "EMERGENCY"
        intent.completion_status = "INCOMPLETE"
        intent.requires_clarification = False
        intent.clarification_questions = []
        return intent

    if intent.issues and all(_backend_completion_check(issue) for issue in intent.issues):
        intent.action_type = "ROUTE"
        intent.completion_status = "COMPLETE"
        intent.requires_clarification = False
        intent.clarification_questions = []
        return intent

    intent.action_type = "CLARIFY"
    intent.completion_status = "INCOMPLETE"
    intent.requires_clarification = True
    intent.safety_flag = False
    intent.clarification_questions = _deterministic_questions(intent.issues)

    return intent


from core import clinical_gate

def _backend_completion_check(issue: ClinicalIssue) -> bool:
    """
    Deterministic check: If we have location + urgency + reported symptoms,
    we deem the issue COMPLETE regardless of LLM opinion.
    
    Updated to use Clinical Gate Logic + Domain-Aware Strictness.
    """
    # Run the Gate Assessment
    clinical_gate.assess_issue_completeness(issue)
    
    # Require at least 3 structured elements before routing
    structured_count = sum(
        1 for k, v in issue.clinical_profile.items() if v
    )

    if structured_count < 3:
        return False
    
    # Check if there are any missing elements
    return len(issue.missing_clinical_elements) == 0


def _answered_field_keys(issue: ClinicalIssue) -> set[str]:
    answers = getattr(issue, "field_answers", {}) or {}
    return {str(k).strip().lower() for k, v in answers.items() if v not in (None, "", [], {})}


def _deterministic_questions(issues: List[ClinicalIssue]) -> List[str]:
    questions: List[str] = []
    seen = set()
    for issue in issues:
        clinical_gate.assess_issue_completeness(issue)
        answered = _answered_field_keys(issue)
        if issue.missing_clinical_elements:
            issue.missing_clinical_elements = [
                key for key in issue.missing_clinical_elements
                if str(key).strip().lower() not in answered
            ]
        q = clinical_gate.get_next_clinical_question(issue) if issue.missing_clinical_elements else None
        if q and q not in seen:
            seen.add(q)
            questions.append(q)
    return questions


def _merge_with_previous_issues(
    new_issues: List[ClinicalIssue],
    old_issues: List[ClinicalIssue]
) -> List[ClinicalIssue]:
    """
    Merges new identified issues with previous state to prevent amnesia.
    Simple heuristic: if clusters map 1:1, merge fields.
    """
    if not old_issues:
        return new_issues
        
    merged = []
    
    # Naive merge: assume generic update to primary issue if 1:1
    # Real logic should fuzzy match 'symptom_cluster'
    
    if len(new_issues) == 1 and len(old_issues) == 1:
        new = new_issues[0]
        old = old_issues[0]
        
        # Merge Booleans (Truth wins)
        if old.has_pain and not new.has_pain: new.has_pain = True
        if old.swelling and not new.swelling: new.swelling = True
        if old.bleeding and not new.bleeding: new.bleeding = True
        # Typo fix + defensive access for backward compatibility.
        if getattr(old, "trauma", False) and not new.trauma:
            new.trauma = True
        
        # Merge Scalars (Preserve old if new is null)
        if old.severity is not None and new.severity is None: new.severity = old.severity
        if old.duration_days is not None and new.duration_days is None: new.duration_days = old.duration_days
        if old.location and not new.location: new.location = old.location
        # Merge explicit field answers.
        if getattr(old, "field_answers", None):
            new.field_answers = {**old.field_answers, **(new.field_answers or {})}
        
        # Merge lists
        for s in old.reported_symptoms:
            if s not in new.reported_symptoms:
                new.reported_symptoms.append(s)

        merged.append(new)
    else:
        # Complex multi-issue updates are harder to deterministically merge without ID tracking.
        # Fallback: Prefer new analysis but try to hydrate empty fields from old if clusters match string
        # This is a safe fallback for now.
        return new_issues
        
    return merged


def _llm_analyze(text: str, history: Optional[list[dict]] = None) -> Optional[IntentResult]:
    """Call Gemini with orchestration prompt, including chat history for context."""
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not found.")
        return None

    try:
        # ── Build Context with Chat History ─────────────────────────
        context = ""
        if history:
            # Use up to last 10 messages for stronger multi-turn state continuity.
            recent = history[-10:]
            context_lines = []
            for m in recent:
                role = m.get("role", "user").upper()
                content = m.get("content", "")
                # Truncate very long messages to save tokens
                if len(content) > 300:
                    content = content[:300] + "..."
                context_lines.append(f"{role}: {content}")
            context = "CONVERSATION HISTORY:\n" + "\n".join(context_lines) + "\n\nCURRENT USER MESSAGE:\n"

        full_prompt = context + text

        import google.genai as genai
        client = genai.Client(api_key=GEMINI_API_KEY)

        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=full_prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.0,  # Strict determinism
                max_output_tokens=1500,
                response_mime_type="application/json"
            ),
        )

        raw_text = response.text.strip()

        # ── Post-LLM Safety Validation ──────────────────────────────
        if not _validate_safety(raw_text):
            logger.warning("LLM output failed safety validation. Returning safe fallback.")
            return IntentResult(
                requires_clarification=True,
                clarification_questions=[
                    "I'd like to understand your symptoms better so I can connect you with the right specialist.",
                    "Could you describe what you're experiencing?"
                ],
                action_type="CLARIFY", # Fixed to CLARIFY
                overall_urgency="MEDIUM"
            )

        # ── Parse JSON ──────────────────────────────────────────────
        if raw_text.startswith("```"):
            raw_text = raw_text.split("\n", 1)[1]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]

        data = json.loads(raw_text)

        # ── Parse Issues ────────────────────────────────────────────
        issues = []
        for i in data.get("issues", []):
            urgency = i.get("urgency", "MEDIUM")
            if urgency not in {"HIGH", "MEDIUM", "LOW"}:
                urgency = "MEDIUM"
            issues.append(ClinicalIssue(
                symptom_cluster=i.get("symptom_cluster", "Unknown symptoms"),
                urgency=urgency,
                reasoning=i.get("reasoning", ""),
                
                # Feature Flags
                has_pain=i.get("has_pain", False),
                severity=i.get("severity"),
                duration_days=i.get("duration_days"),
                thermal_sensitivity=i.get("thermal_sensitivity", False),
                biting_pain=i.get("biting_pain", False),
                swelling=i.get("swelling", False),
                visible_swelling=i.get("visible_swelling", False),
                airway_compromise=i.get("airway_compromise", False),
                trauma=i.get("trauma", False),
                bleeding=i.get("bleeding", False),
                impacted_wisdom=i.get("impacted_wisdom", False),
                
                # Metadata
                location=i.get("location"),
                reported_symptoms=i.get("reported_symptoms", []),
                suspected_category=i.get("suspected_category") # Optional/Deprecated
            ))

        return IntentResult(
            issues=issues,
            overall_urgency=data.get("overall_urgency"),
            requires_clarification=False,
            clarification_questions=[],
            safety_flag=False,
            action_type="UNKNOWN",
            patient_sentiment=data.get("patient_sentiment", "Neutral"),
            completion_status="INCOMPLETE",
        )

    except Exception as e:
        logger.error(f"LLM Analysis failed: {e}")
        return None
