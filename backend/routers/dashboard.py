"""
Dashboard routes — utilization stats and analytics.
All queries are tenant-scoped and require authentication.
"""
import time
from fastapi import APIRouter, Depends
from fastapi.responses import JSONResponse
from sqlalchemy import func
from sqlalchemy.orm import joinedload, Session
from core.dependencies import get_current_user, get_db_session, UserContext
from models.models import Appointment, Doctor, Room, Clinic, CalendarSlot, Staff
from config import SLOTS_PER_DAY
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


# Per-tenant cache with TTL
CACHE_TTL = 60  # seconds
_dashboard_cache: dict[str, dict] = {}


@router.get("/stats")
def get_dashboard_stats(
    user: UserContext = Depends(get_current_user),
    db: Session = Depends(get_db_session),
):
    """Comprehensive dashboard statistics — tenant-scoped and authenticated."""
    tenant_id = user.tenant_id
    cache_key = str(tenant_id)
    current_time = time.time()

    # Check per-tenant cache
    if cache_key in _dashboard_cache:
        cached = _dashboard_cache[cache_key]
        if current_time - cached.get("last_updated", 0) < CACHE_TTL:
            return cached["data"]

    try:
        # 1. Overview counts — TENANT SCOPED
        overview_counts = db.query(
            func.count(Appointment.appt_id).label("total"),
            func.count(Appointment.appt_id).filter(Appointment.status == "SCHEDULED").label("scheduled"),
            func.count(Appointment.appt_id).filter(Appointment.status == "CANCELLED").label("cancelled"),
            func.count(Appointment.appt_id).filter(Appointment.status == "COMPLETED").label("completed"),
            func.count(Appointment.appt_id).filter(Appointment.procedure_type == "Emergency Triage").label("emergency")
        ).filter(
            Appointment.clinic_id == tenant_id
        ).one()

        # 2. Distinct active patients — TENANT SCOPED
        active_patients = db.query(
            func.count(func.distinct(Appointment.patient_id))
        ).filter(
            Appointment.clinic_id == tenant_id
        ).scalar() or 0

        # 3. Specialist utilization — TENANT SCOPED
        doc_booked_counts = db.query(
            CalendarSlot.entity_id,
            func.count(CalendarSlot.id)
        ).filter(
            CalendarSlot.entity_type == "doctor",
            CalendarSlot.booked == True,
            CalendarSlot.tenant_id == tenant_id,
        ).group_by(CalendarSlot.entity_id).all()

        booked_map = {str(eid): count for eid, count in doc_booked_counts}

        doctors = db.query(Doctor).filter(
            Doctor.active == True,
            Doctor.tenant_id == tenant_id,
        ).all()
        doctor_stats = []
        for doc in doctors:
            doc_slots = booked_map.get(str(doc.doctor_id), 0)
            total_available = 5 * SLOTS_PER_DAY
            utilization = round((doc_slots / total_available * 100), 1) if total_available > 0 else 0
            doctor_stats.append({
                "id": str(doc.doctor_id),
                "name": doc.name,
                "booked_slots": doc_slots,
                "utilization_pct": min(utilization, 100),
            })

        # 4. Room utilization — TENANT SCOPED
        room_booked_counts = db.query(
            CalendarSlot.entity_id,
            func.count(CalendarSlot.id)
        ).filter(
            CalendarSlot.entity_type == "room",
            CalendarSlot.booked == True,
            CalendarSlot.tenant_id == tenant_id,
        ).group_by(CalendarSlot.entity_id).all()

        room_booked_map = {str(eid): count for eid, count in room_booked_counts}

        # Fetch scheduled patients per room (full ORM query for joinedload)
        room_patients = (
            db.query(Appointment)
            .options(joinedload(Appointment.patient))
            .filter(
                Appointment.clinic_id == tenant_id,
                Appointment.status == "SCHEDULED",
            )
            .all()
        )

        patients_by_room = {}
        for appt in room_patients:
            rid = str(appt.room_id)
            if rid not in patients_by_room:
                patients_by_room[rid] = []
            patients_by_room[rid].append({
                "appt_id": str(appt.appt_id),
                "patient_name": appt.patient.name if appt.patient else "Unknown",
                "procedure": appt.procedure_type,
                "time": appt.start_time.strftime("%H:%M") if appt.start_time else ""
            })

        rooms = db.query(Room).options(
            joinedload(Room.clinic)
        ).filter(
            Room.status == "active",
            Room.clinic_id == tenant_id,
        ).all()
        room_stats = []
        for room in rooms:
            rid = str(room.room_id)
            room_slots = room_booked_map.get(rid, 0)
            total_available = 5 * SLOTS_PER_DAY
            utilization = round((room_slots / total_available * 100), 1) if total_available > 0 else 0
            room_stats.append({
                "id": rid,
                "name": room.name,
                "clinic": room.clinic.name if room.clinic else "",
                "type": room.type,
                "booked_slots": room_slots,
                "utilization_pct": min(utilization, 100),
                "scheduled_patients": patients_by_room.get(rid, [])
            })

        # 5. Clinic breakdown — TENANT SCOPED (only the tenant's clinic)
        clinic = db.query(Clinic).filter(Clinic.clinic_id == tenant_id).first()
        clinic_appt_count = db.query(
            func.count(Appointment.appt_id)
        ).filter(
            Appointment.status == "SCHEDULED",
            Appointment.clinic_id == tenant_id,
        ).scalar() or 0

        clinic_stats = []
        if clinic:
            clinic_stats.append({
                "id": str(clinic.clinic_id),
                "name": clinic.name,
                "location": clinic.location,
                "scheduled_appointments": clinic_appt_count,
            })

        # 6. Procedure distribution — TENANT SCOPED
        procedure_mix = db.query(
            Appointment.procedure_type,
            func.count(Appointment.appt_id)
        ).filter(
            Appointment.clinic_id == tenant_id
        ).group_by(Appointment.procedure_type).all()

        color_map = {
            "Root Canal": "#6366f1",
            "Consultation": "#8b5cf6",
            "Cleaning": "#ec4899",
            "Emergency Triage": "#f43f5e"
        }
        total_appts = overview_counts.total or 0
        procedure_stats = []
        for name, count in procedure_mix:
            if name:
                procedure_stats.append({
                    "name": name,
                    "count": count,
                    "value": round((count / total_appts * 100), 1) if total_appts > 0 else 0,
                    "color": color_map.get(name, "#64748b")
                })

        # 7. Recent Activity — TENANT SCOPED
        recent_appts = (
            db.query(Appointment)
            .options(joinedload(Appointment.patient))
            .filter(Appointment.clinic_id == tenant_id)
            .order_by(Appointment.created_at.desc())
            .limit(5)
            .all()
        )
        recent_activity = []
        for appt in recent_appts:
            status_type = "info"
            if appt.status == "COMPLETED":
                status_type = "success"
            elif appt.status == "CANCELLED":
                status_type = "warning"

            recent_activity.append({
                "id": str(appt.appt_id),
                "user": "System" if not appt.patient else appt.patient.name,
                "action": f"Booking: {appt.procedure_type}",
                "target": appt.status,
                "time": appt.created_at.strftime("%H:%M") if appt.created_at else "Just now",
                "status": status_type,
                "avatar": (appt.patient.name[:2].upper()) if appt.patient and appt.patient.name else "SY"
            })

        result = {
            "overview": {
                "total_appointments": total_appts,
                "scheduled": overview_counts.scheduled,
                "completed": overview_counts.completed,
                "cancelled": overview_counts.cancelled,
                "emergency_bookings": overview_counts.emergency,
                "active_patients": active_patients,
            },
            "recent_activity": recent_activity,
            "procedure_distribution": procedure_stats,
            "doctor_utilization": doctor_stats,
            "room_utilization": room_stats,
            "clinic_breakdown": clinic_stats,
        }

        # Update per-tenant cache
        _dashboard_cache[cache_key] = {"data": result, "last_updated": current_time}

        return result
    except Exception as e:
        logger.warning(f"Dashboard DB unavailable: {e}")
        return JSONResponse(
            status_code=503,
            content={
                "error": "Database unavailable",
                "message": "Dashboard requires a database connection. Please check your DATABASE_URL.",
            },
        )
