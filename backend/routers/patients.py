"""
Patient routes — registration, listing, profile.
All routes are tenant-scoped and require authentication.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from datetime import date as dt_date
from uuid import UUID
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db_session, UserContext
from models.models import Patient

router = APIRouter()


class PatientCreate(BaseModel):
    name: str
    phone: str
    dob: Optional[str] = None
    email: Optional[str] = None


@router.post("/register")
def register_patient(
    data: PatientCreate,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Register a new patient — tenant-scoped for staff, global for patients."""
    # Check existing — tenant-scoped for staff, global for patients
    query = db.query(Patient).filter(Patient.phone == data.phone)
    if user.role != "patient":
        query = query.filter(Patient.tenant_id == user.tenant_id)
    
    existing = query.first()
    if existing:
        return {
            "patient_id": str(existing.patient_id),
            "name": existing.name,
            "is_new": False,
            "message": "Welcome back!",
        }

    patient = Patient(
        tenant_id=user.tenant_id if user.role != "patient" else None,
        name=data.name,
        phone=data.phone,
        email=data.email,
        dob=dt_date.fromisoformat(data.dob) if data.dob else None,
        is_new=True,
    )
    db.add(patient)
    db.flush()

    return {
        "patient_id": str(patient.patient_id),
        "name": patient.name,
        "is_new": True,
        "message": "Registration successful!",
    }


@router.get("/")
def list_patients(
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """List patients — tenant-scoped for staff, all for patients."""
    query = db.query(Patient)
    if user.role != "patient":
        query = query.filter(Patient.tenant_id == user.tenant_id)
    
    patients = query.order_by(Patient.created_at.desc()).all()
    return [
        {
            "patient_id": str(p.patient_id),
            "name": p.name,
            "phone": p.phone,
            "email": p.email,
            "dob": str(p.dob) if p.dob else None,
            "is_new": p.is_new,
            "created_at": str(p.created_at),
        }
        for p in patients
    ]


@router.get("/{patient_id}")
def get_patient(
    patient_id: UUID,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Get patient profile — tenant-scoped."""
    query = db.query(Patient).filter(Patient.patient_id == patient_id)
    if user.role != "patient":
        query = query.filter(Patient.tenant_id == user.tenant_id)
    
    patient = query.first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")
    return {
        "patient_id": str(patient.patient_id),
        "name": patient.name,
        "phone": patient.phone,
        "email": patient.email,
        "dob": str(patient.dob) if patient.dob else None,
        "is_new": patient.is_new,
        "created_at": str(patient.created_at),
    }
