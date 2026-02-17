"""
Slots routes — Available slot search with constraint solving.
Tenant-scoped and authenticated.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db_session, UserContext
from models.models import Procedure
from core.routing_engine import find_with_fallback

router = APIRouter()


class SlotSearchRequest(BaseModel):
    procedure_id: int
    needs_sedation: bool = False
    preferred_clinic_id: Optional[str] = None
    preferred_doctor_id: Optional[str] = None


@router.post("/search")
def search_slots(
    data: SlotSearchRequest,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """
    Search for available appointment slots with full constraint solving.
    Uses tiered fallback if primary provider is unavailable.
    Scoped to the current tenant (or global for patients).
    """
    proc_query = db.query(Procedure).filter(Procedure.proc_id == data.procedure_id)
    if user.role != "patient":
        proc_query = proc_query.filter(Procedure.tenant_id == user.tenant_id)
    
    procedure = proc_query.first()
    if not procedure:
        raise HTTPException(status_code=404, detail="Procedure not found")

    # Default preferred_clinic_id to tenant's clinic if available
    preferred_clinic = data.preferred_clinic_id or (str(user.tenant_id) if user.tenant_id else None)

    results = find_with_fallback(
        db,
        procedure,
        data.needs_sedation,
        preferred_clinic,
        data.preferred_doctor_id,
        tenant_id=user.tenant_id if user.role != "patient" else None,
    )

    return results


@router.get("/procedures")
def list_procedures(
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """List all available procedures — tenant-scoped (or global for patients)."""
    query = db.query(Procedure)
    if user.role != "patient":
        query = query.filter(Procedure.tenant_id == user.tenant_id)
    procs = query.all()
    return [
        {
            "proc_id": p.proc_id,
            "name": p.name,
            "duration_minutes": p.base_duration_minutes,
            "consult_minutes": p.consult_duration_minutes,
            "requires_anesthetist": p.requires_anesthetist,
            "allow_combo": p.allow_same_day_combo,
        }
        for p in procs
    ]
