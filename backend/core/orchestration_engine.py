from __future__ import annotations
"""
Orchestration Engine — Multi-Issue Clinical Routing + Constraint-Aware Scheduling
Routes distinct clinical issues to compatible resources, resolves to real procedures,
enforces room/equipment/anesthetist constraints via the scheduling engine,
and offers combined slots where possible.
"""
import re
from dataclasses import dataclass, asdict, field
from typing import List, Optional, Dict
from uuid import UUID
from sqlalchemy.orm import Session
import logging

from core.intent_analyzer import ClinicalIssue, IntentResult
from core.triage_engine import triage, triage_by_specialist, TriageResult, CONDITION_PROCEDURE_MAP
from core.routing_engine import find_with_fallback
from models.models import Procedure

logger = logging.getLogger(__name__)


# ═══════════════════════════════════════════════════════════════════════════
#  Data Classes
# ═══════════════════════════════════════════════════════════════════════════

@dataclass
class RoutedIssue:
    issue_index: int
    symptom_cluster: str
    urgency: str
    triage_result: Optional[TriageResult]
    reasoning_triggers: List[str] = field(default_factory=list) # Triggers used for routing
    error: Optional[str] = None
    # Constraint-aware scheduling fields
    procedure_id: Optional[int] = None
    procedure_name: str = "Specialist Evaluation"
    duration_minutes: int = 30
    consult_minutes: int = 0
    room_capability: Optional[dict] = None
    requires_sedation: bool = False
    requires_anesthetist: bool = False
    slots: Optional[dict] = None         # Raw slot search result from find_with_fallback
    fallback_tier: int = 0               # 0=not searched, 1=primary, 2=alt provider, 3=palliative
    fallback_note: Optional[str] = None

@dataclass
class OrchestrationPlan:
    is_emergency: bool
    overall_urgency: str
    routed_issues: List[RoutedIssue]
    suggested_action: str  # ORCHESTRATE, ESCALATE, CLARIFY, GREETING, SMALL_TALK
    issues: List[ClinicalIssue] = field(default_factory=list) # Raw extracted features for UI
    combined_visit_possible: bool = False
    patient_sentiment: str = "Neutral"
    clarification_questions: List[str] = None
    emergency_slots: Optional[dict] = None  # Pre-resolved slots for emergency triage
    clarification: Optional[dict] = None  # Structured missing fields for UI
    fhir_bundle: Optional[dict] = None # HL7 FHIR Payload
    routing_explanation: Optional[str] = None # Liability-Safe Reasoning

    def to_dict(self):
        return {
            "is_emergency": self.is_emergency,
            "overall_urgency": self.overall_urgency,
            "issues": [i.to_dict() for i in self.issues], # Serialize raw issues
            "routed_issues": [
                {
                    "issue_index": r.issue_index,
                    "symptom_cluster": r.symptom_cluster,
                    "urgency": r.urgency,
                    "specialist_type": r.triage_result.specialist_type if r.triage_result else "Dentist",
                    "procedure_id": r.procedure_id,
                    "procedure_name": r.procedure_name,
                    "appointment_type": "Extended Evaluation Appointment" if r.consult_minutes > 0 else "Specialist Consultation",
                    "duration_minutes": r.duration_minutes,
                    "consult_minutes": r.consult_minutes,
                    "reasoning_triggers": r.reasoning_triggers,
                    "room_capability": r.room_capability,
                    "requires_sedation": r.requires_sedation,
                    "requires_anesthetist": r.requires_anesthetist,
                    "slots": r.slots,
                    "fallback_tier": r.fallback_tier,
                    "fallback_note": r.fallback_note,
                    "error": r.error
                }
                for r in self.routed_issues
            ],
            "suggested_action": self.suggested_action,
            "combined_visit_possible": self.combined_visit_possible,
            "patient_sentiment": self.patient_sentiment,
            "clarification_questions": self.clarification_questions or [],
            "emergency_slots": self.emergency_slots,
            "clarification": self.clarification,
            "fhir_bundle": self.fhir_bundle,
            "routing_explanation": self.routing_explanation
        }


# ═══════════════════════════════════════════════════════════════════════════
#  Category → Specialist Mapping
# ═══════════════════════════════════════════════════════════════════════════

CATEGORY_TO_CONDITION_MAP = {
    "endodontic": "root_canal",
    "endodontic concern": "root_canal",
    "root canal": "root_canal",
    "surgical": "wisdom_extraction",
    "surgical concern": "wisdom_extraction",
    "wisdom tooth": "wisdom_extraction",
    "periodontal": "general_checkup",
    "periodontal concern": "general_checkup",
    "restorative": "filling",
    "restorative concern": "filling",
    "filling": "filling",
    "crown": "crown",
    "general": "general_checkup",
    "general concern": "general_checkup",
    "hygiene": "general_checkup",
    "checkup": "general_checkup",
    "cleaning": "general_checkup",
    "emergency": "emergency",
    "emergency concern": "emergency",
}


def _map_category_to_specialist(category: str, detail: str) -> str:
    """
    Heuristic mapping from LLM clinical category to a specialist type.
    """
    cat_lower = category.lower()
    detail_lower = detail.lower()

    if "endodontic" in cat_lower or "root canal" in detail_lower or "nerve" in detail_lower:
        return "Endodontist"
    if "surgical" in cat_lower or "wisdom" in detail_lower or "extraction" in detail_lower:
        return "Oral Surgeon"
    if "periodontal" in cat_lower or "gum" in detail_lower:
        return "Periodontist"
    if "restorative" in cat_lower or "filling" in detail_lower or "crown" in detail_lower or "cap" in detail_lower:
        return "General Dentist"
    if "orthodontic" in cat_lower or "braces" in detail_lower or "aligners" in detail_lower:
        return "Orthodontist"
    if "pediatric" in cat_lower or "child" in detail_lower:
        return "Pediatric Dentist"
    if "hygiene" in cat_lower or "cleaning" in detail_lower or "clean" in detail_lower:
        return "Hygienist"
    if "emergency" in cat_lower or "urgent" in detail_lower:
        return "General Dentist"

    return "General Dentist"


# ═══════════════════════════════════════════════════════════════════════════
#  Drilldown Validation (Clinical Gate Integration)
# ═══════════════════════════════════════════════════════════════════════════

from core import clinical_gate

def _validate_clinical_completeness(intent: IntentResult) -> Optional[List[str]]:
    """
    Uses the Clinical Gate Layer to generate strict doctor-like questioning.
    Returns a list of ONE or more questions if incomplete.
    """
    questions = []
    
    # If the user explicitly asks for clarification or help, we might want to respect that
    # But generally we want to drive the clinical interview.
    
    for issue in intent.issues:
        # 1. Run Assessment
        clinical_gate.assess_issue_completeness(issue)
        clinical_gate.prune_answered_elements(issue)
        
        # 2. Get Next Question (Sequential)
        if issue.missing_clinical_elements:
            q = clinical_gate.get_next_clinical_question(issue)
            if q:
                questions.append(q)
                
    # Deduplicate
    seen = set()
    unique_questions = []
    for q in questions:
        if q not in seen:
            seen.add(q)
            unique_questions.append(q)

    return unique_questions if unique_questions else None


# ═══════════════════════════════════════════════════════════════════════════
#  Orchestrate — Main Entry Point
# ═══════════════════════════════════════════════════════════════════════════

# ═══════════════════════════════════════════════════════════════════════════
#  Layer 2: Clinical Rules (Deterministic)
# ═══════════════════════════════════════════════════════════════════════════

def _classify_condition(issue: ClinicalIssue) -> tuple[str, List[str]]:
    """
    Deterministically maps structured clinical FEATURE FLAGS to a Condition Key.
    Returns (condition_key, reasoning_triggers).
    """
    triggers = []
    
    # ── Tier 1: Emergency Rules ──────────────────────────────────────────────
    if issue.airway_compromise: triggers.append("Airway compromise")
    if issue.trauma: triggers.append("Dental trauma")
    if issue.bleeding: triggers.append("Uncontrolled bleeding")
    
    if triggers:
        return "emergency", triggers
    
    # ── Tier 2: Endodontic Rules (Root Canal) ─────────────────────────────────
    is_severe = (issue.severity or 0) >= 7
    if issue.has_pain:
        if is_severe: triggers.append("Severe pain")
        if issue.thermal_sensitivity: triggers.append("Thermal sensitivity")
        if issue.biting_pain: triggers.append("Biting pain")
        
        if is_severe and (issue.thermal_sensitivity or issue.biting_pain) and not issue.swelling:
            return "root_canal", triggers

    # ── Tier 3: Surgical Rules (Wisdom/Extraction) ────────────────────────────
    triggers = [] # Reset for new classification attempt
    if issue.swelling: triggers.append("Swelling")
    if issue.impacted_wisdom: triggers.append("Impacted wisdom")
    if "wisdom" in (issue.symptom_cluster or "").lower(): triggers.append("Wisdom tooth cluster")
    
    if issue.swelling and (issue.impacted_wisdom or "wisdom" in (issue.symptom_cluster or "").lower()):
        return "wisdom_extraction", triggers
        
    if issue.swelling and "extraction" in (issue.symptom_cluster or "").lower():
         triggers.append("Extraction mentioned")
         return "wisdom_extraction", triggers

    # ── Tier 4: Restorative Rules (Fillings) ──────────────────────────────────
    triggers = []
    if issue.has_pain: triggers.append("Pain")
    if (issue.severity or 0) <= 6: triggers.append("Moderate severity")
    
    if issue.has_pain and (issue.severity or 0) <= 6 and not issue.swelling and not issue.thermal_sensitivity:
        return "filling", triggers
        
    # ── Tier 5: General Fallback ──────────────────────────────────────────────
    triggers = []
    symptoms = (issue.symptom_cluster or "").lower()
    if "root canal" in symptoms: 
        return "root_canal", ["Root canal keyword"]
    if "wisdom" in symptoms: 
        return "wisdom_extraction", ["Wisdom tooth keyword"]
    if "crown" in symptoms: 
        return "crown", ["Crown keyword"]
    if "filling" in symptoms: 
        return "filling", ["Filling keyword"]
    if "clean" in symptoms: 
        return "general_checkup", ["Cleaning/Hygiene keyword"]

    return "general_checkup", ["Routine follow-up"]

# ═══════════════════════════════════════════════════════════════════════════
#  Layer 3: Procedure Resolution (DB Lookup)
# ═══════════════════════════════════════════════════════════════════════════

def _resolve_procedure(
    db: Session,
    condition_key: str,
    tenant_id: UUID | None
) -> Optional[Procedure]:
    """
    Maps Condition Key -> Real DB Procedure.
    Returns None if no matching procedure found.
    """
    proc_name = CONDITION_PROCEDURE_MAP.get(condition_key)
    if not proc_name:
        # Fallback for unmapped conditions
        proc_name = "General Checkup"
        
    # 1. Tenant-Scoped Lookup
    query = db.query(Procedure).filter(Procedure.name == proc_name)
    if tenant_id:
        query = query.filter(Procedure.tenant_id == tenant_id)
    
    proc = query.first()
    
    # 2. Cross-Tenant Fallback (if applicable configuration allows)
    # For strict isolation, we might disable this, but keeping it for safety in dev.
    if not proc and tenant_id:
        proc = db.query(Procedure).filter(Procedure.name == proc_name).first()
        
    return proc

# ═══════════════════════════════════════════════════════════════════════════
#  Layer 4: Constraint-Aware Scheduler (Wrapper)
# ═══════════════════════════════════════════════════════════════════════════

def _find_slots(
    db: Session,
    procedure: Procedure,
    issue: ClinicalIssue,
    tenant_id: UUID | None
) -> Optional[dict]:
    """
    Wraps the constraint solver.
    Enforces room capability, anesthetist, 15-min grid.
    """
    # Determine sedation need (Clinical Issue flag OR Procedure requirement)
    requires_sedation = issue.requires_sedation or procedure.requires_anesthetist
    
    return find_with_fallback(
        db,
        procedure,
        needs_sedation=requires_sedation,
        tenant_id=tenant_id
    )

def orchestrate(
    db: Session,
    intent: IntentResult,
    tenant_id: UUID | None = None
) -> OrchestrationPlan:
    """
    Hybrid 5-Layer Clinical Routing Pipeline.
    1. Semantic Extraction (Done in IntentResult)
    2. Clinical Gate (New Layer: Assessment & Intake)
    3. Clinical Rules (_classify_condition)
    4. Procedure Resolution (_resolve_procedure)
    5. Constraint-Aware Scheduler (_find_slots)
    6. Orchestration Combiner (The Plan)
    """

    # ── Phase 0: Emergency Override (Layer 5 Priority) ────────────────────────
    # Emergency bypasses Clinical Gate completeness checks
    if intent.safety_flag or intent.overall_urgency == "EMERGENCY" or intent.action_type == "ESCALATE":
        # Hard deterministic override
        emergency_proc = _resolve_procedure(db, "emergency", tenant_id)
        emergency_slots = None
        if emergency_proc:
            # We construct a dummy issue for emergency search
            dummy_issue = ClinicalIssue(
                symptom_cluster="Emergency", 
                suspected_category="Emergency",
                urgency="EMERGENCY",
                reasoning="Emergency Override"
            )
            emergency_slots = _find_slots(db, emergency_proc, dummy_issue, tenant_id)
            
        # Generate Enterprise Artifacts for Emergency
        dummy_issue = ClinicalIssue(
             symptom_cluster="Emergency", 
             suspected_category="Emergency",
             urgency="EMERGENCY",
             reasoning="Emergency Override"
        )
        return OrchestrationPlan(
            is_emergency=True,
            overall_urgency="EMERGENCY",
            routed_issues=[],
            suggested_action="ESCALATE",
            issues=intent.issues, 
            patient_sentiment=intent.patient_sentiment,
            emergency_slots=emergency_slots,
            routing_explanation=clinical_gate.get_safe_routing_language(dummy_issue),
            fhir_bundle=clinical_gate.generate_fhir_bundle(dummy_issue)
        )

    # ── Phase 1: Non-Clinical Intents ─────────────────────────────────────────
    if intent.action_type in ("GREETING", "SMALL_TALK"):
        return OrchestrationPlan(
            is_emergency=False,
            overall_urgency="LOW",
            routed_issues=[],
            suggested_action=intent.action_type,
            issues=intent.issues, # Pass Raw Issues
            patient_sentiment=intent.patient_sentiment
        )
            
    # ── Phase 2: Clinical Gate (The "Doctor" Check) ──────────────────────────
    # Check completeness BEFORE routing.
    # Note: Even if LLM says "ROUTE", we assume "CLINICAL_EVALUATION" until proven complete.
    
    validation_questions = _validate_clinical_completeness(intent)
    
    if validation_questions:
         # GATE CLOSED -> Return Clarification Plan
         # We map "CLARIFY" action_type to the frontend
         
         # Construct structured clarification payload
         clarification_issues = []
         for issue in intent.issues:
             if issue.missing_clinical_elements:
                 clarification_issues.append({
                     "issue_id": f"issue_{intent.issues.index(issue)+1}",
                     "summary": issue.symptom_cluster,
                     "missing_fields": clinical_gate.generate_missing_fields(issue) if hasattr(clinical_gate, "generate_missing_fields") else [], # Backwards compat or new func
                     "status": "Incomplete",
                     "missing_elements": issue.missing_clinical_elements
                 })

         return OrchestrationPlan(
            is_emergency=False,
            overall_urgency=intent.overall_urgency or "LOW",
            routed_issues=[],
            suggested_action="CLARIFY",
            issues=intent.issues, # Pass updated issues with profiles
            patient_sentiment=intent.patient_sentiment,
            clarification_questions=validation_questions,
            clarification={
                "issues": clarification_issues,
                "mode": "CLINICAL_INTAKE"
            }
        )

    # ── Phase 3: CORE ROUTING LOOP (Gate Open) ───────────────────────────────
    # Only reachable if validation_questions is None/Empty
    
    routed_issues = []
    
    for idx, issue in enumerate(intent.issues):
        # Layer 2: Classify
        condition_key, triggers = _classify_condition(issue)
        logger.info(f"Layer 2: Issue {idx} classified as '{condition_key}' (Triggers: {triggers})")
        
        # Layer 3: Resolve
        proc = _resolve_procedure(db, condition_key, tenant_id)
        
        triage_res = None
        slots = None
        error = None
        
        if proc:
             # Layer 4: Schedule
             slots = _find_slots(db, proc, issue, tenant_id)
             
             # Construct TriageResult (Legacy compat, wrapper around proc)
             triage_res = TriageResult(
                 procedure_id=proc.proc_id,
                 procedure_name=proc.name,
                 specialist_type="Specialist", 
                 consult_minutes=proc.consult_duration_minutes,
                 treatment_minutes=proc.base_duration_minutes,
                 requires_sedation=issue.requires_sedation or proc.requires_anesthetist,
                 room_capability=proc.required_room_capability,
                 requires_anesthetist=proc.requires_anesthetist,
                 allow_combo=proc.allow_same_day_combo,
                 available_doctors=[] 
             )
        else:
             error = "Procedure resolution failed"
             
        # ── Enterprise Presentation Layer ─────────────────────────────────────────
        CLINICAL_DISPLAY_MAP = {
            "root_canal": "Endodontic Evaluation (Microscope)",
            "wisdom_extraction": "Oral Surgery Consultation (Wisdom)",
            "filling": "Restorative Assessment",
            "crown": "Restorative Assessment (Major)",
            "emergency": "Emergency Triage Assessment"
        }
        
        display_name = CLINICAL_DISPLAY_MAP.get(condition_key, proc.name if proc else "Specialist Evaluation")

        # Construct Output
        ri = RoutedIssue(
            issue_index=idx,
            symptom_cluster=issue.symptom_cluster,
            urgency=issue.urgency,
            triage_result=triage_res,
            reasoning_triggers=triggers,
            procedure_id=proc.proc_id if proc else None,
            procedure_name=display_name,
            duration_minutes=proc.base_duration_minutes if proc else 30,
            consult_minutes=proc.consult_duration_minutes if proc else 0,
            room_capability=proc.required_room_capability if proc else None,
            requires_sedation=issue.requires_sedation or (proc.requires_anesthetist if proc else False),
            requires_anesthetist=proc.requires_anesthetist if proc else False,
            slots=slots,
            fallback_tier=slots.get("tier", 0) if slots else 0,
            fallback_note=slots.get("note") if slots else error,
            error=error
        )
        routed_issues.append(ri)

    # ── Phase 4: Combiner Logic ───────────────────────────────────────────────
    all_success = all(r.procedure_id is not None for r in routed_issues) and len(routed_issues) > 0
    
    can_combine = False
    if all_success and len(routed_issues) > 1:
        # Check if slots share a clinic
        clinic_sets = []
        for r in routed_issues:
            if r.slots:
                 single = {s.get("clinic_id") for s in (r.slots.get("single_slots") or [])}
                 combo = {s.get("clinic_id") for s in (r.slots.get("combo_slots") or [])}
                 clinic_sets.append(single | combo)
        
        if clinic_sets:
            shared = clinic_sets[0]
            for cs in clinic_sets[1:]:
                shared &= cs
            if shared:
                can_combine = True

    # Deterministic Urgency
    urgency_map = {"EMERGENCY": 4, "HIGH": 3, "MEDIUM": 2, "LOW": 1}
    rev_map = {4: "EMERGENCY", 3: "HIGH", 2: "MEDIUM", 1: "LOW"}
    max_urg = 1
    for r in routed_issues:
        u = urgency_map.get(r.urgency, 1)
        if u > max_urg: max_urg = u
    final_urgency = rev_map[max_urg]

    # Calculate Enterprise Artifacts (FHIR + Safe Language)
    # We use the primary (highest urgency) issue for the main explanation/referral
    primary_issue = intent.issues[0] if intent.issues else None
    safe_lang = None
    fhir = None
    
    if primary_issue:
        safe_lang = clinical_gate.get_safe_routing_language(primary_issue)
        fhir = clinical_gate.generate_fhir_bundle(primary_issue)

    return OrchestrationPlan(
        is_emergency=False,
        overall_urgency=final_urgency,
        routed_issues=routed_issues,
        suggested_action="ORCHESTRATE" if all_success else "CLARIFY",
        issues=intent.issues, 
        combined_visit_possible=can_combine,
        patient_sentiment=intent.patient_sentiment,
        routing_explanation=safe_lang,
        fhir_bundle=fhir
    )


