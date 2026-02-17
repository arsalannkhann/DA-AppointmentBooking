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
from typing import Optional, List
from config import GEMINI_API_KEY, GEMINI_MODEL

logger = logging.getLogger(__name__)

# ── Valid values ────────────────────────────────────────────────────────────
VALID_URGENCIES = {"EMERGENCY", "HIGH", "MEDIUM", "LOW", None}

# Minimum confidence to proceed with routing an issue
CONFIDENCE_THRESHOLD = 0.7


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
    missing_fields: List[dict] = field(default_factory=list) # Dynamic UI Requirements

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
    r"trouble\s+breathing",
    r"can'?t\s+breathe",
    r"uncontrollable?\s+bleed",
    r"swelling.{0,20}(eye|throat|neck|airway)",
    r"severe\s+trauma",
    r"jaw\s+(fracture|broken)",
    r"(anaphyla|allergic\s+reaction)",
    r"chest\s+pain",
    r"loss\s+of\s+consciousness",
    r"difficulty\s+swallowing",
    r"(knocked?\s*(out|off)|avulsed)\s*(tooth|teeth)",
    r"(tooth|teeth)\s*(knocked?\s*(out|off)|avulsed)",
    r"heavy\s+bleeding.{0,20}(tooth|gum|mouth)",
    r"pain\s*(9|10)\s*(/|out\s*of)\s*10",
]

_CLARIFICATION_DEFAULTS = [
    "Could you describe your symptoms in more detail?",
    "Where exactly is the pain or problem located?",
    "On a scale of 1-10, how severe is the pain?",
    "Are you experiencing any swelling or bleeding?",
]


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

_SYSTEM_PROMPT = """You are a DENTAL TRIAGE ORCHESTRATOR (FEATURE EXTRACTOR).

You operate as a STATE MACHINE with 3 states:
1. CLARIFY
2. ROUTE
3. ESCALATE

YOUR JOB IS TO EXTRACT CLINICAL FEATURES, NOT DIAGNOSE.

STRICT RULES:
1. Extract structured boolean/int features from the user text.
2. If PAIN is present, extract severity (1-10) and thermal/biting triggers.
3. If SWELLING is present, check for airway/breathing issues (ESCALATE if true).
4. DO NOT diagnose or prescribe.

CLINICAL COMPLETION THRESHOLDS:
- Pain case: needs location + duration + severity.
- Swelling case: needs location + duration + airway check.

If COMPLETE: -> action_type = "ROUTE"
If NOT COMPLETE: -> action_type = "CLARIFY"
If airway/trauma/bleeding: -> action_type = "ESCALATE"

You must return JSON only:

{
  "action_type": "CLARIFY | ROUTE | ESCALATE",
  "issues": [
    {
      "symptom_cluster": "...",
      "urgency": "EMERGENCY | HIGH | MEDIUM | LOW",
      "has_pain": boolean,
      "severity": int (1-10) or null,
      "duration_days": int or null,
      "thermal_sensitivity": boolean,
      "biting_pain": boolean,
      "swelling": boolean,
      "visible_swelling": boolean,
      "airway_compromise": boolean,
      "trauma": boolean,
      "bleeding": boolean,
      "impacted_wisdom": boolean,
      "location": "...",
      "reported_symptoms": ["..."]
    }
  ],
  "clarification_questions": [],
  "completion_status": "INCOMPLETE | COMPLETE",
  "patient_sentiment": "Neutral | Anxious | Frustrated"
}
"""


# ═══════════════════════════════════════════════════════════════════════════
#  Main Analysis Pipeline
# ═══════════════════════════════════════════════════════════════════════════

def analyze_intent(text: str, history: Optional[list[dict]] = None) -> IntentResult:
    """
    Orchestration-ready intent analysis.
    1. Deterministic checks (Greetings, Red Flags).
    2. LLM Extraction (Multi-condition, with chat history).
    3. Post-LLM Safety Validation.
    4. Fallback/Validation.
    """
    stripped = text.strip()
    lower = stripped.lower()

    # ── Tier 0: Empty Input ─────────────────────────────────────────
    if len(stripped) < 1:
        return IntentResult(
            requires_clarification=True,
            clarification_questions=["Please describe your dental concern so I can assist you."],
            action_type="UNKNOWN"
        )

    # ── Tier 1: Deterministic Red Flags (Safety First) ──────────────
    for pat in _RED_FLAGS:
        if re.search(pat, lower):
            return IntentResult(
                overall_urgency="EMERGENCY",
                safety_flag=True,
                action_type="EMERGENCY",
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
    llm_result = _llm_analyze(stripped, history)

    if llm_result:
        return llm_result

    # ── Tier 4: Fallback (Service Unavailable / Failure) ────────────
    return IntentResult(
        requires_clarification=True,
        clarification_questions=_CLARIFICATION_DEFAULTS,
        action_type="UNKNOWN",
        overall_urgency="LOW"
    )



def _backend_completion_check(issue: ClinicalIssue) -> bool:
    """
    Deterministic check: If we have location + urgency + reported symptoms,
    we deem the issue COMPLETE regardless of LLM opinion.
    """
    # Pain/Swelling usually necessitates location
    has_location = bool(issue.location)

    # Needs some symptoms
    has_symptoms = len(issue.reported_symptoms) > 0 or bool(issue.symptom_cluster)

    # Needs urgency (default is MEDIUM if unknown, so usually present)
    has_urgency = bool(issue.urgency)

    return has_location and has_symptoms and has_urgency


def _llm_analyze(text: str, history: Optional[list[dict]] = None) -> Optional[IntentResult]:
    """Call Gemini with orchestration prompt, including chat history for context."""
    if not GEMINI_API_KEY:
        logger.error("GEMINI_API_KEY not found.")
        return None

    try:
        # ── Build Context with Chat History ─────────────────────────
        context = ""
        if history:
            # Use up to last 6 messages for context (balance between context and token cost)
            recent = history[-6:]
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
                action_type="CLINICAL",
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
            issues.append(ClinicalIssue(
                symptom_cluster=i.get("symptom_cluster", "Unknown symptoms"),
                urgency=i.get("urgency", "MEDIUM"),
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

        # ── Deterministic Completion Override (Risk 1 Fix) ──────────
        # If structured fields are present, force COMPLETE status
        if issues and all(_backend_completion_check(i) for i in issues):
            data["completion_status"] = "COMPLETE"
            data["action_type"] = "ROUTE"
            data["clarification_questions"] = []

        return IntentResult(
            issues=issues,
            overall_urgency=data.get("overall_urgency"),
            requires_clarification=data.get("action_type") == "CLARIFY" and data.get("completion_status") != "COMPLETE",
            clarification_questions=[] if data.get("completion_status") == "COMPLETE" else data.get("clarification_questions", []),
            safety_flag=data.get("action_type") == "ESCALATE",
            action_type=data.get("action_type", "UNKNOWN"),
            patient_sentiment=data.get("patient_sentiment", "Neutral"),
            completion_status=data.get("completion_status", "INCOMPLETE")
        )

    except Exception as e:
        logger.error(f"LLM Analysis failed: {e}")
        return None
