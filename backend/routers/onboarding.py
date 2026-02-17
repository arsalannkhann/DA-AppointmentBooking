"""
Onboarding routes — guided setup wizard for new clinics.
Admin-only: add rooms, specializations, doctors, check status.
"""
from datetime import time as dt_time
from typing import List, Optional

from fastapi import APIRouter, HTTPException, Depends, status
from pydantic import BaseModel
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db_session, require_role, UserContext
from models.models import (
    Clinic, Room, Doctor, Specialization, DoctorSpecialization,
    AvailabilityTemplate, AuditLog,
)

router = APIRouter()


# ── Request Schemas ──────────────────────────────────────────────────────────

class RoomCreate(BaseModel):
    name: str
    type: str = "operatory"
    capabilities: dict = {}
    equipment: list = []
    sedation_capable: bool = False


class SpecializationCreate(BaseModel):
    name: str


class DoctorAvailabilityCreate(BaseModel):
    day_of_week: int  # 0=Mon, 6=Sun
    start_time: str   # "09:00"
    end_time: str      # "17:00"
    clinic_id: Optional[str] = None  # If None, use tenant's first clinic


class DoctorCreate(BaseModel):
    name: str
    email: Optional[str] = None
    npi: Optional[str] = None
    specialization_ids: List[int] = []
    availability: List[DoctorAvailabilityCreate] = []


# ── Onboarding Status ───────────────────────────────────────────────────────

@router.get("/status")
def onboarding_status(
    user: UserContext = Depends(require_role("admin")),
    db: Session = Depends(get_db_session),
):
    """Check onboarding progress for the current tenant."""
    tenant_id = user.tenant_id

    has_rooms = db.query(Room).filter(Room.clinic_id == tenant_id).first() is not None
    has_specializations = db.query(Specialization).filter(Specialization.tenant_id == tenant_id).first() is not None
    has_doctors = db.query(Doctor).filter(Doctor.tenant_id == tenant_id).first() is not None

    clinic = db.query(Clinic).filter(Clinic.clinic_id == tenant_id).first()
    is_complete = clinic.onboarding_complete if clinic else False

    # Count items for progress display
    room_count = db.query(Room).filter(Room.clinic_id == tenant_id).count()
    spec_count = db.query(Specialization).filter(Specialization.tenant_id == tenant_id).count()
    doctor_count = db.query(Doctor).filter(Doctor.tenant_id == tenant_id).count()

    return {
        "rooms": has_rooms,
        "specializations": has_specializations,
        "doctors": has_doctors,
        "complete": is_complete,
        "counts": {
            "rooms": room_count,
            "specializations": spec_count,
            "doctors": doctor_count,
        },
    }


# ── Step 1: Add Rooms ───────────────────────────────────────────────────────

@router.post("/rooms", status_code=status.HTTP_201_CREATED)
def add_rooms(
    rooms: List[RoomCreate],
    user: UserContext = Depends(require_role("admin")),
    db: Session = Depends(get_db_session),
):
    """Bulk-add rooms for the tenant's clinic."""
    tenant_id = user.tenant_id
    created = []

    for r in rooms:
        room = Room(
            clinic_id=tenant_id,
            name=r.name,
            type=r.type,
            capabilities=r.capabilities,
            equipment=r.equipment,
            sedation_capable=r.sedation_capable,
        )
        db.add(room)
        db.flush()
        created.append({
            "room_id": str(room.room_id),
            "name": room.name,
            "type": room.type,
        })

    # Audit
    db.add(AuditLog(
        tenant_id=tenant_id,
        user_id=user.user_id,
        action="ONBOARDING_ADD_ROOMS",
        entity_type="room",
        details={"count": len(created)},
    ))

    return {"created": created, "count": len(created)}


# ── Step 2: Add Specializations ─────────────────────────────────────────────

@router.post("/specializations", status_code=status.HTTP_201_CREATED)
def add_specializations(
    specs: List[SpecializationCreate],
    user: UserContext = Depends(require_role("admin")),
    db: Session = Depends(get_db_session),
):
    """Bulk-add specializations for the tenant."""
    tenant_id = user.tenant_id
    created = []

    for s in specs:
        # Check for duplicate within tenant
        existing = (
            db.query(Specialization)
            .filter(Specialization.tenant_id == tenant_id, Specialization.name == s.name)
            .first()
        )
        if existing:
            created.append({"spec_id": existing.spec_id, "name": existing.name, "existing": True})
            continue

        spec = Specialization(tenant_id=tenant_id, name=s.name)
        db.add(spec)
        db.flush()
        created.append({"spec_id": spec.spec_id, "name": spec.name, "existing": False})

    # Audit
    db.add(AuditLog(
        tenant_id=tenant_id,
        user_id=user.user_id,
        action="ONBOARDING_ADD_SPECIALIZATIONS",
        entity_type="specialization",
        details={"count": len(created)},
    ))

    return {"created": created, "count": len(created)}


# ── Step 3: Add Doctors ──────────────────────────────────────────────────────

@router.post("/doctors", status_code=status.HTTP_201_CREATED)
def add_doctors(
    doctors: List[DoctorCreate],
    user: UserContext = Depends(require_role("admin")),
    db: Session = Depends(get_db_session),
):
    """Add doctors with specializations and availability."""
    tenant_id = user.tenant_id
    created = []

    for d in doctors:
        doctor = Doctor(
            tenant_id=tenant_id,
            name=d.name,
            email=d.email,
            npi=d.npi,
        )
        db.add(doctor)
        db.flush()

        # Link specializations
        for spec_id in d.specialization_ids:
            spec = (
                db.query(Specialization)
                .filter(Specialization.spec_id == spec_id, Specialization.tenant_id == tenant_id)
                .first()
            )
            if spec:
                db.add(DoctorSpecialization(doctor_id=doctor.doctor_id, spec_id=spec_id))

        # Create availability templates
        for avail in d.availability:
            clinic_id = avail.clinic_id or str(tenant_id)
            parts_start = avail.start_time.split(":")
            parts_end = avail.end_time.split(":")

            db.add(AvailabilityTemplate(
                resource_id=doctor.doctor_id,
                resource_type="DOCTOR",
                clinic_id=clinic_id,
                day_of_week=avail.day_of_week,
                start_time=dt_time(int(parts_start[0]), int(parts_start[1])),
                end_time=dt_time(int(parts_end[0]), int(parts_end[1])),
            ))

        db.flush()
        created.append({
            "doctor_id": str(doctor.doctor_id),
            "name": doctor.name,
            "specialization_ids": d.specialization_ids,
        })

    # Audit
    db.add(AuditLog(
        tenant_id=tenant_id,
        user_id=user.user_id,
        action="ONBOARDING_ADD_DOCTORS",
        entity_type="doctor",
        details={"count": len(created)},
    ))

    return {"created": created, "count": len(created)}


# ── Step 4: Complete Onboarding ──────────────────────────────────────────────

@router.post("/complete")
def complete_onboarding(
    user: UserContext = Depends(require_role("admin")),
    db: Session = Depends(get_db_session),
):
    """Validate all steps are done and mark onboarding complete."""
    tenant_id = user.tenant_id

    has_rooms = db.query(Room).filter(Room.clinic_id == tenant_id).first() is not None
    has_specs = db.query(Specialization).filter(Specialization.tenant_id == tenant_id).first() is not None
    has_docs  = db.query(Doctor).filter(Doctor.tenant_id == tenant_id).first() is not None

    missing = []
    if not has_rooms:
        missing.append("rooms")
    if not has_specs:
        missing.append("specializations")
    if not has_docs:
        missing.append("doctors")

    if missing:
        raise HTTPException(
            status_code=400,
            detail=f"Onboarding incomplete. Missing: {', '.join(missing)}",
        )

    clinic = db.query(Clinic).filter(Clinic.clinic_id == tenant_id).first()
    clinic.onboarding_complete = True

    # Audit
    db.add(AuditLog(
        tenant_id=tenant_id,
        user_id=user.user_id,
        action="ONBOARDING_COMPLETE",
        entity_type="clinic",
        entity_id=str(tenant_id),
    ))

    return {"message": "Onboarding complete! Your clinic is ready.", "complete": True}
