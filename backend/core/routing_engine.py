from __future__ import annotations
"""
Routing Engine — Tiered fallback search when primary provider is unavailable.
All searches are tenant-scoped.

Tier 1: Same specialization at preferred clinic
Tier 2: Primary doctor at other clinics (within same tenant)
Tier 3: Any qualified doctor at any clinic (within same tenant)
"""
from uuid import UUID
from sqlalchemy.orm import Session
from models.models import (
    Doctor, DoctorSpecialization, Procedure, Room,
    AvailabilityTemplate, Specialization,
)
from core.scheduling_engine import find_slots, SlotOption
from core.optimizer import optimize_slots


def find_with_fallback(
    db: Session,
    procedure: Procedure,
    needs_sedation: bool = False,
    preferred_clinic_id: str | None = None,
    preferred_doctor_id: str | None = None,
    *,
    tenant_id: UUID | None = None,
) -> dict:
    """
    Execute tiered search and return results with fallback info.
    All tiers are scoped to tenant_id.
    """
    # Primary search — tenant-scoped
    primary = find_slots(db, procedure, needs_sedation, preferred_clinic_id, tenant_id=tenant_id)
    ranked = optimize_slots(primary, preferred_clinic_id, preferred_doctor_id)

    if ranked:
        # Separate combos from consult-only
        combos = [s for s in ranked if s.type == "COMBO"]
        singles = [s for s in ranked if s.type != "COMBO"]
        return {
            "tier": 1,
            "tier_label": "Primary Results",
            "combo_slots": [s.to_dict() for s in combos[:5]],
            "single_slots": [s.to_dict() for s in singles[:5]],
            "total_found": len(ranked),
        }

    # Tier 2: Search with relaxed constraints (any clinic, still same tenant)
    fallback = find_slots(db, procedure, needs_sedation, preferred_clinic_id=None, tenant_id=tenant_id)
    ranked_fb = optimize_slots(fallback)

    if ranked_fb:
        combos = [s for s in ranked_fb if s.type == "COMBO"]
        singles = [s for s in ranked_fb if s.type != "COMBO"]
        return {
            "tier": 2,
            "tier_label": "Alternative Providers Available",
            "combo_slots": [s.to_dict() for s in combos[:5]],
            "single_slots": [s.to_dict() for s in singles[:5]],
            "total_found": len(ranked_fb),
        }

    # Tier 3: Get palliative care with General Dentist — tenant-scoped
    gd_query = db.query(Specialization).filter(Specialization.name == "General Dentist")
    if tenant_id:
        gd_query = gd_query.filter(Specialization.tenant_id == tenant_id)
    gd_spec = gd_query.first()

    if gd_spec:
        gd_proc_query = db.query(Procedure).filter(Procedure.required_spec_id == gd_spec.spec_id)
        if tenant_id:
            gd_proc_query = gd_proc_query.filter(Procedure.tenant_id == tenant_id)
        gd_proc = gd_proc_query.first()

        if gd_proc:
            palliative = find_slots(db, gd_proc, False, tenant_id=tenant_id)
            ranked_p = optimize_slots(palliative)
            if ranked_p:
                return {
                    "tier": 3,
                    "tier_label": "Palliative Care (Specialist Unavailable)",
                    "combo_slots": [],
                    "single_slots": [s.to_dict() for s in ranked_p[:5]],
                    "total_found": len(ranked_p),
                    "note": "No specialist available. Offering General Dentist for pain management.",
                }

    return {
        "tier": 0,
        "tier_label": "No Availability",
        "combo_slots": [],
        "single_slots": [],
        "total_found": 0,
        "note": "No slots found. Please contact the clinic directly.",
    }
