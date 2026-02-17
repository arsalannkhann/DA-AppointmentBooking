"""
Patient Auth — Global patient registration and login.
Patients are NOT tenant-bound. Clinic is assigned at appointment booking.
"""
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from pydantic import BaseModel, EmailStr
from typing import List, Optional
from uuid import UUID

from datetime import date as dt_date
from models.models import Patient, Clinic, TokenBlacklist, LoginAttempt, AuditLog
from core.auth import (
    hash_password, verify_password, create_access_token,
    check_login_rate_limit, reset_login_attempts
)
from core.dependencies import get_current_user, get_db_session

router = APIRouter(prefix="/api/auth/patient", tags=["Patient Auth"])


# ── SCHEMAS ──────────────────────────────────────────────────────────────────

class PatientRegister(BaseModel):
    name: str
    email: EmailStr
    password: str
    phone: Optional[str] = None
    dob: Optional[str] = None  # YYYY-MM-DD
    preferred_clinic_id: Optional[UUID] = None  # Optional — chatbot will route

class PatientLogin(BaseModel):
    email: EmailStr
    password: str

class Token(BaseModel):
    access_token: str
    token_type: str
    patient_id: UUID
    patient_name: str

class PublicClinic(BaseModel):
    id: UUID
    name: str


# ── ROUTES ───────────────────────────────────────────────────────────────────

@router.get("/clinics", response_model=List[PublicClinic])
def list_public_clinics(db: Session = Depends(get_db_session)):
    """List clinics with completed onboarding (for optional preference)."""
    clinics = db.query(Clinic).filter(Clinic.onboarding_complete == True).all()
    return [{"id": c.clinic_id, "name": c.name} for c in clinics]


@router.post("/register", status_code=status.HTTP_201_CREATED)
def register_patient(data: PatientRegister, db: Session = Depends(get_db_session)):
    """
    Register a new patient account (global — no clinic required).
    Preferred clinic is stored but not enforced.
    """
    # 1. Check if email already exists globally
    existing = db.query(Patient).filter(Patient.email == data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # 2. Verify preferred clinic if provided
    preferred_clinic = None
    if data.preferred_clinic_id:
        preferred_clinic = db.query(Clinic).filter(
            Clinic.clinic_id == data.preferred_clinic_id
        ).first()
        if not preferred_clinic:
            raise HTTPException(status_code=404, detail="Preferred clinic not found")

    # 3. Create Patient (tenant_id = preferred_clinic or None)
    hashed_pw = hash_password(data.password)
    new_patient = Patient(
        tenant_id=data.preferred_clinic_id,  # Nullable — patient is global
        name=data.name,
        email=data.email,
        phone=data.phone,
        hashed_password=hashed_pw,
        dob=dt_date.fromisoformat(data.dob) if data.dob else None,
        is_new=True,
    )
    db.add(new_patient)
    db.flush()  # Assign patient_id before audit log
    
    # Audit
    db.add(AuditLog(
        tenant_id=data.preferred_clinic_id,
        patient_id=new_patient.patient_id,
        action="REGISTER",
        entity_type="patient",
        entity_id=str(new_patient.patient_id),
    ))
    
    db.flush()
    db.refresh(new_patient)

    return {
        "message": "Patient registered successfully",
        "patient_id": new_patient.patient_id,
        "patient_name": new_patient.name,
    }


@router.post("/login", response_model=Token)
def login_patient(data: PatientLogin, db: Session = Depends(get_db_session)):
    """
    Login a patient globally (no clinic required).
    Token carries tenant_id if patient has a preferred clinic.
    """
    # 1. Rate limit
    if not check_login_rate_limit(db, data.email):
        raise HTTPException(status_code=429, detail="Too many login attempts. Try again later.")

    # 2. Find patient by email (global lookup)
    patient = db.query(Patient).filter(Patient.email == data.email).first()

    # 3. Verify password
    if not patient or not patient.hashed_password or not verify_password(data.password, patient.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid credentials")

    # 4. Success — reset rate limiter
    reset_login_attempts(db, data.email)

    # 5. Create token — tenant_id may be None for global patients
    tenant_id_str = str(patient.tenant_id) if patient.tenant_id else ""
    access_token = create_access_token(
        user_id=str(patient.patient_id),
        tenant_id=tenant_id_str,
        role="patient",
    )

    # 6. Audit
    db.add(AuditLog(
        tenant_id=patient.tenant_id,
        patient_id=patient.patient_id,
        action="LOGIN",
        entity_type="patient",
        entity_id=str(patient.patient_id),
    ))

    return {
        "access_token": access_token,
        "token_type": "bearer",
        "patient_id": patient.patient_id,
        "patient_name": patient.name,
    }
