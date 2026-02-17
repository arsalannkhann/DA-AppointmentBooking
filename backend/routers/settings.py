"""
Settings routes — patient profile + preferences.
Tenant-scoped and authenticated.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import date as dt_date, datetime
from sqlalchemy.orm import Session

from core.dependencies import get_current_user, get_db_session, UserContext
from models.models import Patient, PatientSettings

router = APIRouter()


class SettingsUpdate(BaseModel):
    name: Optional[str] = None
    email: Optional[str] = None
    phone: Optional[str] = None
    dob: Optional[str] = None
    notifications: Optional[bool] = None
    dark_mode: Optional[bool] = None
    language: Optional[str] = None


def _serialize(patient: Patient, settings: PatientSettings) -> dict:
    return {
        "patient_id": str(patient.patient_id),
        "name": patient.name,
        "phone": patient.phone,
        "email": patient.email,
        "dob": str(patient.dob) if patient.dob else None,
        "is_new": patient.is_new,
        "created_at": str(patient.created_at),
        "notifications": settings.notifications,
        "dark_mode": settings.dark_mode,
        "language": settings.language,
    }


@router.get("/{patient_id}")
def get_settings(
    patient_id: UUID,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Fetch patient profile + preferences — tenant-scoped."""
    # For patients, allow access by patient_id (global patients may have null tenant_id)
    query = db.query(Patient).filter(Patient.patient_id == patient_id)
    if user.role == "patient":
        # Patients can only access their own settings
        if str(patient_id) != str(user.user_id):
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        # Staff/admin: scope to their tenant
        query = query.filter(Patient.tenant_id == user.tenant_id)

    patient = query.first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    settings = db.query(PatientSettings).filter(
        PatientSettings.patient_id == patient_id
    ).first()

    if not settings:
        settings = PatientSettings(patient_id=patient_id, tenant_id=patient.tenant_id)
        db.add(settings)
        db.flush()

    return _serialize(patient, settings)


@router.put("/{patient_id}")
def update_settings(
    patient_id: UUID,
    data: SettingsUpdate,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Update patient profile + preferences — tenant-scoped."""
    # For patients, allow access by patient_id (global patients may have null tenant_id)
    query = db.query(Patient).filter(Patient.patient_id == patient_id)
    if user.role == "patient":
        if str(patient_id) != str(user.user_id):
            raise HTTPException(status_code=403, detail="Forbidden")
    else:
        query = query.filter(Patient.tenant_id == user.tenant_id)

    patient = query.first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    if data.name is not None:
        patient.name = data.name
    if data.email is not None:
        patient.email = data.email
    if data.phone is not None:
        patient.phone = data.phone
    if data.dob is not None:
        patient.dob = dt_date.fromisoformat(data.dob) if data.dob else None

    settings = db.query(PatientSettings).filter(
        PatientSettings.patient_id == patient_id
    ).first()

    if not settings:
        settings = PatientSettings(patient_id=patient_id, tenant_id=patient.tenant_id)
        db.add(settings)

    if data.notifications is not None:
        settings.notifications = data.notifications
    if data.dark_mode is not None:
        settings.dark_mode = data.dark_mode
    if data.language is not None:
        settings.language = data.language

    settings.updated_at = datetime.utcnow()
    db.flush()

    return _serialize(patient, settings)
