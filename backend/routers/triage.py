"""
Triage routes — symptom analysis with hard guardrails.
NEVER routes to scheduling without validated clinical intent.
Tenant-scoped and authenticated.
"""
from fastapi import APIRouter, Depends
from typing import Optional, List
from sqlalchemy.orm import Session

from schemas.triage import TriageRequest
from core.dependencies import get_current_user, get_db_session, UserContext
from core.intent_analyzer import analyze_intent
from core.emergency_handler import handle_emergency
from core.rate_limit import AuthenticatedRateLimit
from config import RATE_LIMIT_CHATBOT, RATE_LIMIT_TENANT_CHATBOT
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


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
    Clinical Orchestration Pipeline:
    1. Multi-condition extraction (intent_analyzer) with chat history context
    2. Clinical issue routing (orchestration_engine)
    3. Emergency escalation (emergency_handler)
    """
    from core.orchestration_engine import orchestrate

    # Convert Pydantic ChatMessage history to dicts for the analyzer
    history_dicts = None
    if data.history:
        history_dicts = [{"role": m.role, "content": m.content} for m in data.history]

    # 1. Intent Analysis (with chat history)
    intent = analyze_intent(data.symptoms, history_dicts, data.structured_data)

    # 2. Orchestration
    plan = orchestrate(db, intent, tenant_id=user.tenant_id)

    # 3. Build Response
    response_payload = plan.to_dict()

    # ── Emergency ────────────────────────────────────────────────────
    if plan.suggested_action == "ESCALATE":
        emergency_slot = None
        try:
            emergency_slot = handle_emergency(db, tenant_id=user.tenant_id)
        except Exception as e:
            logger.warning(f"DB unavailable for emergency lookup: {e}")

        response_payload["emergency_slot"] = emergency_slot
        response_payload["message"] = (
            "🚨 **EMERGENCY DETECTED**\n\n"
            "Your symptoms indicate a condition requiring immediate attention.\n"
            + ("An emergency slot has been reserved." if emergency_slot else "Please proceed to the nearest emergency room.")
        )
        return response_payload

    # ── Greeting ─────────────────────────────────────────────────────
    if plan.suggested_action == "GREETING":
        response_payload["message"] = (
            "👋 Hi! I'm your SmartDental AI assistant. "
            "I can help you book appointments for multiple issues at once.\n\n"
            "Please describe your symptoms, for example:\n"
            '• "I have a toothache and also need a cleaning"'
        )

    # ── Small Talk ───────────────────────────────────────────────────
    elif plan.suggested_action == "SMALL_TALK":
        response_payload["message"] = (
            "I am a clinical AI designed to help triage dental concerns and schedule specialist evaluations. "
            "I don't diagnose or prescribe — I help connect you with the right specialist.\n\n"
            "How can I help you today?"
        )

    # ── Clarification ────────────────────────────────────────────────
    elif plan.suggested_action == "CLARIFY":
        questions = plan.clarification_questions or intent.clarification_questions or ["Could you provide more details?"]

        # Sentiment-aware tone
        if plan.patient_sentiment == "Anxious":
            intro = "I understand this can be concerning. To make sure we connect you with the right specialist, I need a bit more information:\n\n"
        elif plan.patient_sentiment == "Frustrated":
            intro = "I want to help you as quickly as possible. I just need a few more details:\n\n"
        else:
            intro = "I need a bit more information to help you effectively:\n\n"

        response_payload["message"] = intro + "\n".join([f"• {q}" for q in questions])

    # ── Orchestrate (Success) ────────────────────────────────────────
    elif plan.suggested_action == "ORCHESTRATE":
        summaries = []
        for i, issue in enumerate(plan.routed_issues):
            specialist = issue.triage_result.specialist_type if issue.triage_result else "Dentist"
            sedation_note = " *(sedation available)*" if (issue.triage_result and issue.triage_result.requires_sedation) else ""
            summaries.append(f"{i+1}. **{issue.symptom_cluster}** → Evaluation by **{specialist}**{sedation_note}")

        combo_text = ""
        if plan.combined_visit_possible and len(plan.routed_issues) > 1:
            combo_text = "\n\n✨ Good news — we may be able to schedule these evaluations during a **single visit**."

        issue_word = "concern" if len(plan.routed_issues) == 1 else "concerns"
        intro = f"Based on the information provided, I've identified **{len(plan.routed_issues)} {issue_word}** that warrant specialist evaluation:\n\n"

        response_payload["message"] = intro + "\n".join(summaries) + combo_text

    return response_payload
