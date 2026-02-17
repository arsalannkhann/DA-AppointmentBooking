"""
Appointment routes — booking, listing, cancellation.
All routes are tenant-scoped and require authentication.
"""
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
from uuid import UUID
from sqlalchemy.orm import joinedload, Session

from core.dependencies import get_current_user, get_db_session, UserContext
from models.models import Appointment, Patient, CalendarSlot
from core.scheduling_engine import book_appointment, SlotUnavailableError
from core.rate_limit import AuthenticatedRateLimit
from config import RATE_LIMIT_CREATE_APPOINTMENT

router = APIRouter()


class BookingRequest(BaseModel):
    patient_id: str
    procedure_id: int
    slot: dict


@router.post("/book", dependencies=[Depends(AuthenticatedRateLimit(limit=RATE_LIMIT_CREATE_APPOINTMENT, window=3600, scope="tenant"))])
def book(
    data: BookingRequest,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Book an appointment — tenant-scoped."""
    try:
        pid = UUID(data.patient_id)
    except ValueError:
        raise HTTPException(status_code=400, detail="Invalid patient ID format")

    patient_query = db.query(Patient).filter(Patient.patient_id == pid)
    if user.tenant_id:
        patient_query = patient_query.filter(Patient.tenant_id == user.tenant_id)
    
    patient = patient_query.first()
    if not patient:
        raise HTTPException(status_code=404, detail="Patient not found")

    try:
        result = book_appointment(db, data.slot, data.patient_id, data.procedure_id, tenant_id=user.tenant_id)
    except SlotUnavailableError as e:
        raise HTTPException(status_code=409, detail=str(e))

    return {
        "success": True,
        "appointment": result,
        "message": f"Appointment confirmed for {patient.name}!",
    }


@router.get("/patient/{patient_id}")
def get_patient_appointments(
    patient_id: str,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Get all appointments for a patient — tenant-scoped."""
    try:
        if user.role == "patient" and str(user.user_id) != patient_id:
            raise HTTPException(status_code=403, detail="Forbidden: cannot view other patients' appointments")

        query = (
            db.query(Appointment)
            .options(
                joinedload(Appointment.doctor),
                joinedload(Appointment.room),
                joinedload(Appointment.clinic),
                joinedload(Appointment.procedure),
            )
            .filter(Appointment.patient_id == UUID(patient_id))
        )
        if user.role != "patient":
            query = query.filter(Appointment.clinic_id == user.tenant_id)
            
        appts = query.order_by(Appointment.start_time.desc()).all()
        return [
            {
                "appt_id": str(a.appt_id),
                "procedure": a.procedure_type or (a.procedure.name if a.procedure else ""),
                "doctor": a.doctor.name if a.doctor else "",
                "room": a.room.name if a.room else "",
                "clinic": a.clinic.name if a.clinic else "",
                "start_time": str(a.start_time),
                "end_time": str(a.end_time),
                "status": a.status,
                "created_at": str(a.created_at),
            }
            for a in appts
        ]
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.patch("/{appt_id}/cancel")
def cancel_appointment(
    appt_id: UUID,
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Cancel an appointment and free calendar slots — tenant-scoped."""
    query = db.query(Appointment).filter(Appointment.appt_id == appt_id)
    if user.role == "patient":
        query = query.filter(Appointment.patient_id == user.user_id)
    else:
        query = query.filter(Appointment.clinic_id == user.tenant_id)
    
    appt = query.first()
    if not appt:
        raise HTTPException(status_code=404, detail="Appointment not found")

    appt.status = "CANCELLED"

    db.query(CalendarSlot).filter(CalendarSlot.appt_id == appt_id).update(
        {"booked": False, "appt_id": None}
    )

    return {"success": True, "message": "Appointment cancelled."}


@router.get("/")
def list_all_appointments(
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """List all appointments for the clinic — staff/admin only."""
    if user.role == "patient" or not user.tenant_id:
        raise HTTPException(status_code=403, detail="Forbidden: Patients cannot list all appointments")

    appts = (
        db.query(Appointment)
        .options(
            joinedload(Appointment.doctor),
            joinedload(Appointment.room),
            joinedload(Appointment.clinic),
            joinedload(Appointment.procedure),
            joinedload(Appointment.patient),
        )
        .filter(Appointment.clinic_id == user.tenant_id)
        .order_by(Appointment.start_time.desc())
        .all()
    )

    return [
        {
            "appt_id": str(a.appt_id),
            "patient_name": a.patient.name if a.patient else "Unknown",
            "procedure": a.procedure_type or (a.procedure.name if a.procedure else ""),
            "doctor": a.doctor.name if a.doctor else "",
            "room": a.room.name if a.room else "",
            "clinic": a.clinic.name if a.clinic else "",
            "start_time": str(a.start_time),
            "end_time": str(a.end_time),
            "status": a.status,
            "created_at": str(a.created_at),
        }
        for a in appts
    ]
