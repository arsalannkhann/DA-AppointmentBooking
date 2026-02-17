"""
Triage routes — symptom analysis with hard guardrails.
NEVER routes to scheduling without validated clinical intent.
Tenant-scoped and authenticated.
"""
from fastapi import APIRouter, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db_session, UserContext
from core.intent_analyzer import analyze_intent, CONFIDENCE_THRESHOLD
from core.triage_engine import triage
from core.emergency_handler import handle_emergency
from core.rate_limit import AuthenticatedRateLimit
from config import RATE_LIMIT_CHATBOT, RATE_LIMIT_TENANT_CHATBOT
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class TriageRequest(BaseModel):
    symptoms: str
    history: Optional[list[dict]] = None


@router.post("/analyze", dependencies=[
    Depends(AuthenticatedRateLimit(limit=RATE_LIMIT_CHATBOT, window=3600, scope="user")),
    Depends(AuthenticatedRateLimit(limit=RATE_LIMIT_TENANT_CHATBOT, window=86400, scope="tenant"))
])
def analyze_symptoms(
    data: TriageRequest,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """
    Full triage pipeline with strict safety controls:
    1. Intent analysis (greeting → emergency → LLM → keyword)
    2. Hard guardrail: GREETING/SMALL_TALK/UNKNOWN → never route
    3. Confidence gate: < 0.7 → force clarification
    4. Emergency override if red_flag
    5. Procedure mapping + doctor search (only for routable intents)
    """
    intent = analyze_intent(data.symptoms, data.history)

    # ═══ HARD GUARDRAIL: Non-clinical categories → DO NOT ROUTE ═══
    if intent.category in ("GREETING", "SMALL_TALK"):
        return {
            "intent": intent.to_dict(),
            "is_emergency": False,
            "triage": None,
            "action": "GREET",
            "message": "👋 Hi! I'm your SmartDental AI assistant. "
                       "Please describe your dental concern so I can help you book the right appointment.\n\n"
                       "For example:\n"
                       '• "I have a throbbing pain in my back tooth"\n'
                       '• "I need my wisdom teeth removed"\n'
                       '• "I want a routine checkup and cleaning"',
        }

    if intent.category == "APPOINTMENT_REQUEST" and not intent.condition:
        return {
            "intent": intent.to_dict(),
            "is_emergency": False,
            "triage": None,
            "action": "CLARIFY",
            "message": "I'd be happy to help you book an appointment! "
                       "To find the right specialist, could you describe your dental concern?\n\n"
                       "For example, are you experiencing pain, do you need a checkup, "
                       "or is there a specific procedure you need?",
        }

    if intent.category == "UNKNOWN" or intent.requires_clarification:
        return {
            "intent": intent.to_dict(),
            "is_emergency": False,
            "triage": None,
            "action": "CLARIFY",
            "message": intent.follow_up_question or (
                "I need a bit more detail to help you properly. Could you describe:\n"
                "• Where exactly is the pain or issue?\n"
                "• Is it sharp, throbbing, or dull?\n"
                "• How severe is it on a scale of 1–10?\n"
                "• Is there any swelling or bleeding?"
            ),
        }

    # ═══ CONFIDENCE GATE: Low confidence → force clarification ═══
    if intent.confidence < CONFIDENCE_THRESHOLD:
        return {
            "intent": intent.to_dict(),
            "is_emergency": False,
            "triage": None,
            "action": "CLARIFY",
            "message": f"I think this might be related to {intent.condition.replace('_', ' ') if intent.condition else 'a dental issue'}, "
                       f"but I'm not confident enough to proceed (confidence: {intent.confidence:.0%}).\n\n"
                       + (intent.follow_up_question or "Could you provide more specific details about your symptoms?"),
        }

        # ═══ EMERGENCY OVERRIDE ═══
    if intent.red_flag or intent.category == "EMERGENCY":
        emergency_slot = None
        triage_result = None
        try:
            emergency_slot = handle_emergency(db, tenant_id=user.tenant_id)
            # Find common emergency procedure
            triage_result = triage(db, "emergency", False, tenant_id=user.tenant_id)
        except Exception as e:
            logger.warning(f"DB unavailable for emergency lookup: {e}")

        return {
            "intent": intent.to_dict(),
            "is_emergency": True,
            "emergency_slot": emergency_slot,
            "triage": triage_result.to_dict() if triage_result else None,
            "action": "EMERGENCY",
            "message": "🚨 **EMERGENCY DETECTED**\n\n"
                       + intent.reasoning + "\n\n"
                       + ("An immediate triage slot has been found." if emergency_slot
                          else "Please visit the nearest Emergency Room or call emergency services immediately."),
        }

    # ═══ VALIDATED CLINICAL INTENT → Proceed to triage ═══
    triage_result = None
    try:
        triage_result = triage(db, intent.condition, intent.requires_sedation, tenant_id=user.tenant_id)
    except Exception as e:
        logger.warning(f"DB unavailable for triage: {e}")

    if not triage_result:
        return {
            "intent": intent.to_dict(),
            "is_emergency": False,
            "triage": None,
            "action": "CLARIFY",
            "message": f"AI analysis identified: **{intent.condition.replace('_', ' ')}** (confidence: {intent.confidence:.0%}).\n\n"
                       "However, I couldn't find a matching procedure in our system. "
                       "Could you provide additional details?",
        }

    return {
        "intent": intent.to_dict(),
        "is_emergency": False,
        "triage": triage_result.to_dict(),
        "action": "ROUTE",
        "message": f"Based on your symptoms, you may need: **{triage_result.procedure_name}** "
                   f"(confidence: {intent.confidence:.0%})",
    }
