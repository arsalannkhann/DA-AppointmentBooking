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
    procedure_id: int
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


def triage(
    db: Session,
    condition: str,
    needs_sedation: bool = False,
    *,
    tenant_id: UUID | None = None,
) -> Optional[TriageResult]:
    """
    Map a condition key to a concrete procedure + find qualified doctors.
    Queries are scoped to tenant_id if provided.
    """
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
