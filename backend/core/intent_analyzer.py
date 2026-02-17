from __future__ import annotations
"""
Intent Analyzer — Production-grade clinical triage with strict category
classification, confidence scoring, and hallucination guardrails.

Categories:
  GREETING, SMALL_TALK, SYMPTOM_DESCRIPTION, APPOINTMENT_REQUEST,
  EMERGENCY, UNKNOWN

Hard Rule: NEVER map to a medical condition without explicit symptoms.
"""
import re
import json
from dataclasses import dataclass, asdict
from typing import Optional
from config import GEMINI_API_KEY, GEMINI_MODEL


# ── Valid values ────────────────────────────────────────────────────────────
VALID_CATEGORIES = {
    "GREETING", "SMALL_TALK", "SYMPTOM_DESCRIPTION",
    "APPOINTMENT_REQUEST", "EMERGENCY", "UNKNOWN",
}
VALID_CONDITIONS = {
    "root_canal", "wisdom_extraction", "general_checkup",
    "filling", "crown", "emergency", "emergency_triage", None,
}
VALID_URGENCIES = {"EMERGENCY", "HIGH", "MEDIUM", "LOW", None}

CONFIDENCE_THRESHOLD = 0.6  # Minimum confidence to route to scheduling (Lowers friction)


@dataclass
class IntentResult:
    category: str                      # GREETING | SYMPTOM_DESCRIPTION | etc.
    condition: Optional[str]           # e.g. "root_canal" or None
    urgency: Optional[str]             # EMERGENCY | HIGH | MEDIUM | LOW | None
    confidence: float                  # 0.0–1.0
    requires_sedation: bool
    red_flag: bool
    requires_clarification: bool
    reasoning: str
    follow_up_question: Optional[str] = None

    @property
    def is_routable(self) -> bool:
        """True only if this intent should proceed to scheduling."""
        return (
            self.category == "SYMPTOM_DESCRIPTION"
            and self.condition is not None
            and self.confidence >= CONFIDENCE_THRESHOLD
            and not self.requires_clarification
        )

    def to_dict(self):
        d = asdict(self)
        d["is_routable"] = self.is_routable
        return d


# ── Greeting / Small-Talk Detection (deterministic, runs first) ────────────
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

# ── Emergency Red-Flag Patterns ────────────────────────────────────────────
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
]

_RUSH_PATTERNS = [
    (r"(severe|intense|unbearable|excruciating)\s+(throb|pain)", "HIGH"),
    (r"(broken|fractured)\s+tooth.{0,20}(nerve|exposed|pulp)", "HIGH"),
    (r"post.?op.{0,15}(infection|pus|abscess|fever)", "HIGH"),
    (r"pain\s+(8|9|10)\s*(out\s*of|\/)\s*10", "HIGH"),
    (r"woke\s+(me|up)\s+.{0,10}(night|sleep)", "HIGH"),
]

# ── Keyword → Condition Mapping ────────────────────────────────────────────
# ── Keyword → Condition Mapping ────────────────────────────────────────────
_KEYWORD_MAP = [
    # ── Tier 1: Specific Procedure Phrases (Highest Consistency) ──
    # Crown/Veneer specific damage (Must be before generic 'crack'/'chip')
    (r"(crack(ed)?\s+crown|broken\s+crown|loose\s+crown|crown\s+(crack|broken|fell|off))", "crown"),
    (r"(crown|cap|veneer)\s*(tooth|need|replace|broken|fell|off)", "crown"),
    
    # Wisdom Tooth specific
    (r"(wisdom|extract|remov|pull|surgery|impacted|third\s*molar)", "wisdom_extraction"),

    # Root Canal specific symptoms
    (r"throb.{0,15}(pain|ache).{0,20}(back|molar|rear)", "root_canal"),
    (r"(root\s*canal|pulpitis|endodontic|abscess|swollen|swelling|pus|infection|throb|nerve|sensitivity)", "root_canal"),
    (r"(sensitivity).{0,10}(cold|hot)", "root_canal"),

    # ── Tier 2: Condition Object Keywords ──
    (r"(crown|cap|veneer)", "crown"),

    # ── Tier 3: Generic Restorative / Damage Keywords ──
    (r"(fill|cavity|caries|decay|hole|chip|crack|fracture)", "filling"),
    (r"(sharp|pain).{0,15}(biting|chewing)", "filling"),

    # ── Tier 4: Fallbacks ──
    (r"(trauma|accident|knocked|bleeding|emergency|broken\s*jaw)", "emergency"),
    (r"(clean|checkup|check.up|hygiene|routine|x-ray|exam|eval)", "general_checkup"),
    (r"(stuck|lodged).{0,15}(tooth|molar)", "general_checkup"),
]

_GENERIC_PAIN_PATTERNS = [
    r"tooth\s*(pain|ache)",
    r"mild\s*(pain|ache)",
    r"dental\s*(pain|ache)"
]

# ── Sedation Signals ──────────────────────────────────────────────────────
_SEDATION_PATTERNS = [
    r"(sedat|knock.{0,5}out|put.{0,5}(me|to)\s*sleep|asleep|anaesthe|general\s*an|IV\s*sed)",
    r"(dental\s*phobia|terrified|extreme.*anxiet|panic)",
    r"(want|need|prefer).{0,10}(sleep|unconscious|sedation)",
]

# ── Vague / Insufficient Symptom Patterns ──────────────────────────────────
_VAGUE_PATTERNS = [
    r"^(my\s*)?tooth\s*(hurts?|aches?|pains?)[\s!?.]*$",
    r"^(i\s*have\s*)?tooth\s*ache[\s!?.]*$",
    r"^(pain|hurt|ache|sore|problem)[\s!?.]*$",
    r"^i\s*(have|got|feel)\s*(a\s*)?(pain|ache|problem|issue)[\s!?.]*$",
    r"^(something|it)\s*(is\s*)?(wrong|hurts?)[\s!?.]*$",
    r"^not\s*feeling\s*(good|well)[\s!?.]*$",
    r"^(need|want)\s*(help|appointment|dentist)[\s!?.]*$",
]

# ── Clarification Questions ────────────────────────────────────────────────
CLARIFICATION_QUESTIONS = [
    "Could you describe your symptoms in more detail? For example:\n• Where exactly is the pain?\n• Is it sharp, throbbing, or dull?\n• How severe is it on a scale of 1–10?\n• Is there any swelling or bleeding?",
]


# ═══════════════════════════════════════════════════════════════════════════
#  Gemini System Prompt (production-grade)
# ═══════════════════════════════════════════════════════════════════════════
_SYSTEM_PROMPT = """You are a clinical triage intent analyzer for a dental appointment orchestration system.

Your job is to classify user input into EXACTLY one of these categories:
1. GREETING — greetings, pleasantries ("hi", "hello", "thanks")
2. SMALL_TALK — general questions, non-clinical ("who are you", "what can you do")
3. SYMPTOM_DESCRIPTION — explicit dental symptoms with clinical detail
4. APPOINTMENT_REQUEST — request to book/schedule without symptoms
5. EMERGENCY — red-flag symptoms (trauma, uncontrolled bleeding, breathing difficulty)
6. UNKNOWN — ambiguous or insufficient clinical information

🚨 CRITICAL RULES:
1. CONTEXT AWARENESS: You will be provided with the current user message and a brief chat history. Use the history to resolve ambiguities. If the user previously mentioned "I have pain" and now says "it's in my back molar", combine these to SYMPTOM_DESCRIPTION.
2. If the message contains NO clinical information (e.g., "hi", "hello", "thanks", "okay") and no relevant history exists, classify as GREETING or SMALL_TALK.
3. NEVER infer a medical condition unless EXPLICIT symptom details are present in the current message or history.
4. If symptom details are STILL insufficient after considering history (e.g., just "it hurts" with no location or severity ever mentioned), return category UNKNOWN with requires_clarification=true.
5. If the user mentions "swelling", "abscess", "throb", or "nerve pain", prioritize condition "root_canal".
6. If the user mentions "bleeding" or "trauma", prioritize condition "emergency".
7. If the user mentions "cleaning" or "checkup", prioritize condition "general_checkup".
8. Confidence must honestly reflect certainty. Vague inputs = low confidence.
9. If the user asks for a specific procedure (e.g., "I need a root canal"), classify as SYMPTOM_DESCRIPTION for that condition with high confidence, even if they didn't describe every symptom.

📤 Return ONLY this JSON structure, no markdown fences:
{
  "category": "GREETING | SMALL_TALK | SYMPTOM_DESCRIPTION | APPOINTMENT_REQUEST | EMERGENCY | UNKNOWN",
  "condition": null or "root_canal" or "wisdom_extraction" or "general_checkup" or "filling" or "crown" or "emergency",
  "urgency": "LOW" or "MEDIUM" or "HIGH" or "EMERGENCY" or null,
  "confidence": 0.0 to 1.0,
  "requires_sedation": true or false,
  "red_flag": true or false,
  "requires_clarification": true or false,
  "reasoning": "brief clinical justification incorporating context if used",
  "follow_up_question": "clarifying question if needed, else null"
}"""


# ═══════════════════════════════════════════════════════════════════════════
#  Main Analysis Pipeline
# ═══════════════════════════════════════════════════════════════════════════

def analyze_intent(text: str, history: Optional[list[dict]] = None) -> IntentResult:
    """
    Five-tier analysis pipeline (Deterministic-First):
    1. Greeting / small-talk detection (deterministic)
    2. Emergency red-flag regex (deterministic)
    3. Clinical Deterministic Overrides (Sedation, specific patterns)
    4. Keyword Mapping (Broad coverage)
    5. Gemini LLM (Fallback for ambiguity)
    """
    stripped = text.strip()
    lower = stripped.lower()

    # ── Tier 0: Empty or too short ──────────────────────────────────
    if len(stripped) < 1:
        return IntentResult(
            category="UNKNOWN",
            condition=None,
            urgency=None,
            confidence=0.0,
            requires_sedation=False,
            red_flag=False,
            requires_clarification=True,
            reasoning="Empty input received.",
            follow_up_question="Please describe your dental concern so I can assist you.",
        )

    # ── Tier 1: Greeting / Small-Talk (hard-coded, deterministic) ──
    for pat in _GREETING_PATTERNS:
        if re.match(pat, lower):
            return IntentResult(
                category="GREETING",
                condition=None,
                urgency=None,
                confidence=0.98,
                requires_sedation=False,
                red_flag=False,
                requires_clarification=False,
                reasoning="User provided a greeting, no medical information.",
            )

    for pat in _SMALL_TALK_PATTERNS:
        if re.match(pat, lower):
            return IntentResult(
                category="SMALL_TALK",
                condition=None,
                urgency=None,
                confidence=0.95,
                requires_sedation=False,
                red_flag=False,
                requires_clarification=False,
                reasoning="User asked a general question, no clinical intent.",
            )

    # ── Tier 2: Emergency Red-Flag Regex ────────────────────────────
    # 2a. Check for numeric pain scale emergency (9-10/10)
    if re.search(r"pain\s*(9|10)\s*(/|out\s*of)\s*10", lower):
        return IntentResult(
            category="EMERGENCY",
            condition="emergency",
            urgency="EMERGENCY",
            confidence=0.95,
            requires_sedation=False,
            red_flag=True,
            requires_clarification=False,
            reasoning="Severe 9–10/10 pain qualifies as emergency."
        )

    # 2b. Standard Red Flags
    for pat in _RED_FLAGS:
        if re.search(pat, lower):
            return IntentResult(
                category="EMERGENCY",
                condition="emergency",
                urgency="EMERGENCY",
                confidence=0.99,
                requires_sedation=False,
                red_flag=True,
                requires_clarification=False,
                reasoning=f"Emergency red-flag detected in: '{stripped[:60]}...'",
            )

    # ── Tier 3: Clinical Deterministic Overrides ────────────────────
    
    # 3a. Post-Extraction Bleeding = EMERGENCY (Must check before extraction keyword)
    if re.search(r"bleed|bleeding", lower) and re.search(r"after\s*(extraction|surgery|removal)", lower):
        return IntentResult(
            category="EMERGENCY",
            condition="emergency",
            urgency="EMERGENCY",
            confidence=0.95,
            requires_sedation=False,
            red_flag=True,
            requires_clarification=False,
            reasoning="Post-extraction bleeding qualifies as dental emergency."
        )

    # 3b. Extraction + Sedation = Wisdom Extraction
    if re.search(r"extract|extraction", lower):
        if any(re.search(p, lower) for p in _SEDATION_PATTERNS):
            return IntentResult(
                category="SYMPTOM_DESCRIPTION",
                condition="wisdom_extraction",
                urgency="MEDIUM",
                confidence=0.9,
                requires_sedation=True,
                red_flag=False,
                requires_clarification=False,
                reasoning="User explicitly requested extraction with sedation."
            )

    # ── Tier 4: Deterministic Keyword Mapping ───────────────────────
    kw_result = _keyword_analyze(stripped)
    if kw_result.condition:
        # If keyword match meets routing threshold, return immediately (skips LLM)
        if kw_result.confidence >= CONFIDENCE_THRESHOLD:
             return kw_result
    
    # ── Tier 4b: Generic Pain Fallback ──────────────────────────────
    # Only if no specific condition found yet
    for pat in _GENERIC_PAIN_PATTERNS:
        if re.search(pat, lower):
             return IntentResult(
                category="SYMPTOM_DESCRIPTION",
                condition="general_checkup",
                urgency="LOW",
                confidence=0.75,
                requires_sedation=False,
                red_flag=False,
                requires_clarification=False,
                reasoning="Generic non-specific dental pain mapped to general_checkup."
            )

    # ── Tier 2.5: Vague symptom guardrail ───────────────────────────
    # Moved after generic pain check to avoid trapping valid generic complaints
    for pat in _VAGUE_PATTERNS:
        if re.match(pat, lower):
            return IntentResult(
                category="UNKNOWN",
                condition=None,
                urgency=None,
                confidence=0.35,
                requires_sedation=False,
                red_flag=False,
                requires_clarification=True,
                reasoning="Symptom description is too vague to determine condition.",
                follow_up_question=CLARIFICATION_QUESTIONS[0],
            )

    # ── Tier 5: Gemini LLM (Fallback) ──────────────────────────────
    llm_result = _llm_analyze(stripped, history)
    if llm_result:
        # Validate LLM didn't hallucinate — apply hard guardrails
        llm_result = _validate_llm_result(llm_result, lower)
        return llm_result

    # Fallback to weak keyword match if LLM failed
    return kw_result


def _validate_llm_result(result: IntentResult, lower_text: str) -> IntentResult:
    """
    Post-validation guardrails on LLM output to prevent hallucination.
    """
    # Force category validation
    if result.category not in VALID_CATEGORIES:
        result.category = "UNKNOWN"
        result.requires_clarification = True

    # If LLM returned a medical condition for a non-clinical category, strip it
    if result.category in ("GREETING", "SMALL_TALK"):
        result.condition = None
        result.urgency = None
        result.requires_clarification = False
        result.red_flag = False

    # If LLM hallucinated a condition with low confidence, force clarification
    if result.condition is not None and result.confidence < CONFIDENCE_THRESHOLD:
        result.requires_clarification = True
        if not result.follow_up_question:
            result.follow_up_question = CLARIFICATION_QUESTIONS[0]

    # Validate condition value
    if result.condition not in VALID_CONDITIONS:
        result.condition = None
        result.requires_clarification = True

    # Validate urgency
    if result.urgency not in VALID_URGENCIES:
        result.urgency = None

    return result


def _llm_analyze(text: str, history: Optional[list[dict]] = None) -> Optional[IntentResult]:
    """Call Gemini with strict clinical triage prompt and history context."""
    if not GEMINI_API_KEY:
        return None
    try:
        # Prepare context from history
        context = ""
        if history:
            # Only take last 4 messages to keep it focused
            recent = history[-4:]
            context = "\n".join([f"{m['role'].upper()}: {m['content']}" for m in recent])
            context = f"CHAT HISTORY:\n{context}\n\nCURRENT USER MESSAGE:\n"

        full_prompt = context + text
        import google.genai as genai
        client = genai.Client(api_key=GEMINI_API_KEY)
        
        response = client.models.generate_content(
            model=GEMINI_MODEL,
            contents=full_prompt,
            config=genai.types.GenerateContentConfig(
                system_instruction=_SYSTEM_PROMPT,
                temperature=0.05,
                max_output_tokens=400,
            ),
        )

        raw = response.text.strip()
        # Strip markdown fences if present
        if raw.startswith("```"):
            raw = raw.split("\n", 1)[1]
            if raw.endswith("```"):
                raw = raw[:-3]
            raw = raw.strip()

        data = json.loads(raw)

        return IntentResult(
            category=data.get("category", "UNKNOWN"),
            condition=data.get("condition"),
            urgency=data.get("urgency"),
            confidence=float(data.get("confidence", 0.5)),
            requires_sedation=bool(data.get("requires_sedation", False)),
            red_flag=bool(data.get("red_flag", False)),
            requires_clarification=bool(data.get("requires_clarification", False)),
            reasoning=data.get("reasoning", ""),
            follow_up_question=data.get("follow_up_question"),
        )
    except Exception:
        return None


def _keyword_analyze(text: str) -> IntentResult:
    """Deterministic keyword-based fallback with honest confidence."""
    lower = text.lower()

    # Detect condition
    condition = None
    matched_keyword = False
    for pat, cond in _KEYWORD_MAP:
        if re.search(pat, lower):
            condition = cond
            matched_keyword = True
            break

    if not matched_keyword:
        # No keyword matched — insufficient info
        return IntentResult(
            category="UNKNOWN",
            condition=None,
            urgency=None,
            confidence=0.3,
            requires_sedation=False,
            red_flag=False,
            requires_clarification=True,
            reasoning="Could not identify a specific dental condition from the description.",
            follow_up_question=CLARIFICATION_QUESTIONS[0],
        )

    # Detect urgency
    urgency = "MEDIUM"
    for pat, urg in _RUSH_PATTERNS:
        if re.search(pat, lower):
            urgency = urg
            break
    if condition == "general_checkup":
        urgency = "LOW"

    # Detect sedation
    needs_sedation = any(re.search(p, lower) for p in _SEDATION_PATTERNS)

    # Confidence based on specificity of input
    word_count = len(lower.split())
    # Boost confidence for specific medical terms — short-but-specific inputs
    # should still get high confidence when they clearly name a procedure
    specific_terms = [
        "root canal", "wisdom", "filling", "cleaning", "crown",
        "extraction", "extract", "implant", "checkup", "check-up",
        "cavity", "abscess", "veneer", "denture", "braces",
        "impacted", "surgery", "removal", "toothache",
    ]
    term_matches = sum(1 for term in specific_terms if term in lower)
    base_boost = min(0.3, term_matches * 0.15)  # Up to 0.3 boost for specific terms
    confidence = min(0.9, 0.55 + (word_count * 0.03) + base_boost)  # More generous base

    return IntentResult(
        category="SYMPTOM_DESCRIPTION",
        condition=condition,
        urgency=urgency,
        confidence=round(confidence, 2),
        requires_sedation=needs_sedation,
        red_flag=False,
        requires_clarification=confidence < CONFIDENCE_THRESHOLD,
        reasoning=f"Keyword analysis: matched condition='{condition}' from text.",
        follow_up_question=CLARIFICATION_QUESTIONS[0] if confidence < CONFIDENCE_THRESHOLD else None,
    )
