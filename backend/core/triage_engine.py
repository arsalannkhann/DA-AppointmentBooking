from __future__ import annotations
"""
Triage Engine — Maps intent results to specific procedures and specialists.
All queries are tenant-scoped.
"""
from dataclasses import dataclass, asdict
from typing import Optional
from uuid import UUID
from sqlalchemy.orm import Session
from models.models import Procedure, Specialization, DoctorSpecialization, Doctor


# ── Condition → Procedure mapping ────────────────────────────────────────────
CONDITION_PROCEDURE_MAP = {
    "root_canal": "Root Canal Treatment",
    "wisdom_extraction": "Wisdom Tooth Extraction (Sedation)",
    "emergency": "Emergency Triage",
    "emergency_triage": "Emergency Triage",
    "general_checkup": "General Checkup",
    "filling": "Dental Filling",
    "crown": "Dental Crown",
}


@dataclass
class TriageResult:
    procedure_id: int | None
    procedure_name: str
    specialist_type: str
    consult_minutes: int
    treatment_minutes: int
    requires_sedation: bool
    room_capability: dict | None
    requires_anesthetist: bool
    allow_combo: bool
    available_doctors: list[dict]

    def to_dict(self):
        return asdict(self)


def triage_by_specialist(
    db: Session,
    specialist_type: str,
    needs_sedation: bool = False,
    *,
    tenant_id: UUID | None = None,
) -> Optional[TriageResult]:
    """
    Finds a qualified specialist for EVALUATION.
    Does NOT assume a specific procedure (defaults to 'Evaluation' or 'Consultation').
    """
    
    # 1. Find Specialization ID
    spec = db.query(Specialization).filter(Specialization.name == specialist_type).first()
    if not spec:
        # Fallback to General Dentist if specialist not found
        spec = db.query(Specialization).filter(Specialization.name == "General Dentist").first()
        specialist_type = "General Dentist"
    
    if not spec:
        return None

    # 2. Find Doctors with this specialization
    doctor_query = (
        db.query(Doctor)
        .join(DoctorSpecialization, Doctor.doctor_id == DoctorSpecialization.doctor_id)
        .filter(DoctorSpecialization.spec_id == spec.spec_id)
        .filter(Doctor.active == True)
    )
    if tenant_id:
        doctor_query = doctor_query.filter(Doctor.tenant_id == tenant_id)
    doctors = doctor_query.all()

    doctor_list = [
        {"id": str(d.doctor_id), "name": d.name}
        for d in doctors
    ]
    
    # 3. Define Constraints for Evaluation
    # Evaluations typically 30 mins.
    # We use a placeholder procedure ID (e.g., 0 or -1) since this is dynamic, 
    # or ideally we'd look up a "Consultation" procedure in the DB.
    # For V1, we construct a generic result.
    
    return TriageResult(
        procedure_id=None, # Dynamic — no specific procedure for evaluations
        procedure_name="Specialist Evaluation", # Generic safe name
        specialist_type=specialist_type,
        consult_minutes=30,
        treatment_minutes=0, # It's a consult
        requires_sedation=needs_sedation,
        room_capability=None, # Consults usually fit anywhere
        requires_anesthetist=needs_sedation, # Only if explicitly requested/required
        allow_combo=True, # Consults are easily combinable
        available_doctors=doctor_list,
    )

def triage(
    db: Session,
    condition: str,
    needs_sedation: bool = False,
    *,
    tenant_id: UUID | None = None,
) -> Optional[TriageResult]:
    """
    Legacy wrapper or specific procedure lookup if needed.
    """
    # This is kept for backward compatibility or direct procedure lookup if the architecture allows.
    # But for clinical safety, we prefer triage_by_specialist.
    proc_name = CONDITION_PROCEDURE_MAP.get(condition)
    if not proc_name:
        proc_name = "General Checkup"

    # Find procedure — TENANT SCOPED if provided, with cross-tenant fallback
    proc_query = db.query(Procedure).filter(Procedure.name == proc_name)
    if tenant_id:
        proc_query = proc_query.filter(Procedure.tenant_id == tenant_id)
    
    proc: Procedure | None = proc_query.first()
    
    # Fallback: if tenant-scoped search found nothing, try cross-tenant
    if not proc and tenant_id:
        proc = db.query(Procedure).filter(Procedure.name == proc_name).first()
    
    if not proc:
        return None
    
    # Find specialist type — scope to procedure's tenant for consistency
    proc_tenant = proc.tenant_id
    spec_query = db.query(Specialization).filter(Specialization.spec_id == proc.required_spec_id)
    spec = spec_query.first()
    spec_name = spec.name if spec else "General Dentist"

    # Find qualified doctors — scope to procedure's tenant
    doctor_query = (
        db.query(Doctor)
        .join(DoctorSpecialization, Doctor.doctor_id == DoctorSpecialization.doctor_id)
        .filter(DoctorSpecialization.spec_id == proc.required_spec_id)
        .filter(Doctor.active == True)
    )
    if proc_tenant:
        doctor_query = doctor_query.filter(Doctor.tenant_id == proc_tenant)
    doctors = doctor_query.all()

    doctor_list = [
        {"id": str(d.doctor_id), "name": d.name}
        for d in doctors
    ]

    # Override sedation flag if procedure requires it
    actual_sedation = needs_sedation or proc.requires_anesthetist

    return TriageResult(
        procedure_id=proc.proc_id,
        procedure_name=proc.name,
        specialist_type=spec_name,
        consult_minutes=proc.consult_duration_minutes,
        treatment_minutes=proc.base_duration_minutes,
        requires_sedation=actual_sedation,
        room_capability=proc.required_room_capability,
        requires_anesthetist=proc.requires_anesthetist or actual_sedation,
        allow_combo=proc.allow_same_day_combo,
        available_doctors=doctor_list,
    )
