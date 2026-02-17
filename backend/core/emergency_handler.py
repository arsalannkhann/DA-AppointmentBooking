from __future__ import annotations
"""
Emergency Handler — Overrides normal routing for red-flag patients.
Forces immediate General Dentist triage, ignores preferences.
All queries are tenant-scoped.
"""
from datetime import datetime, timedelta, time as dt_time
from uuid import UUID
from sqlalchemy.orm import Session
from models.models import (
    Doctor, DoctorSpecialization, Specialization, Room,
    AvailabilityTemplate, Appointment, CalendarSlot,
)
from config import DAY_START_HOUR, DAY_END_HOUR, SLOT_MINUTES, SLOTS_PER_DAY
import math


def handle_emergency(
    db: Session,
    *,
    tenant_id: UUID | None = None,
) -> dict | None:
    """
    Find the absolute next available 15-min slot with ANY General Dentist
    at the tenant's clinics. Overrides preference windows and combo logic.
    Scoped to tenant_id.
    """
    # Get General Dentist spec — TENANT SCOPED
    gd_query = db.query(Specialization).filter(Specialization.name == "General Dentist")
    if tenant_id:
        gd_query = gd_query.filter(Specialization.tenant_id == tenant_id)
    gd_spec = gd_query.first()
    if not gd_spec:
        return None

    # Get all active GD doctors — TENANT SCOPED if provided
    gd_doc_query = (
        db.query(Doctor)
        .join(DoctorSpecialization)
        .filter(DoctorSpecialization.spec_id == gd_spec.spec_id)
        .filter(Doctor.active == True)
    )
    if tenant_id:
        gd_doc_query = gd_doc_query.filter(Doctor.tenant_id == tenant_id)
    gd_doctors = gd_doc_query.all()
    if not gd_doctors:
        return None

    now = datetime.utcnow()
    today = now.date()

    # Search today + next 3 days for absolute earliest slot
    for day_offset in range(4):
        check_date = today + timedelta(days=day_offset)
        dow = check_date.weekday()

        for doc in gd_doctors:
            # Check if doctor works this day
            templates = (
                db.query(AvailabilityTemplate)
                .filter(
                    AvailabilityTemplate.resource_id == doc.doctor_id,
                    AvailabilityTemplate.resource_type == "DOCTOR",
                    AvailabilityTemplate.day_of_week == dow,
                )
                .all()
            )
            if not templates:
                continue

            for tmpl in templates:
                clinic_id = tmpl.clinic_id

                # Get a room at this clinic (any operatory) — same tenant
                room_query = (
                    db.query(Room)
                    .filter(Room.clinic_id == clinic_id, Room.status == "active")
                )
                room = room_query.first()
                if not room:
                    continue

                # Build availability mask for this doctor on this day
                start_block = max(0, (tmpl.start_time.hour - DAY_START_HOUR) * (60 // SLOT_MINUTES))
                end_block = min(SLOTS_PER_DAY, (tmpl.end_time.hour - DAY_START_HOUR) * (60 // SLOT_MINUTES))

                # If today, skip past blocks
                if check_date == today:
                    current_block = max(0, (now.hour - DAY_START_HOUR) * (60 // SLOT_MINUTES) + now.minute // SLOT_MINUTES)
                    start_block = max(start_block, current_block + 1)

                # Check each block for first free one
                for block in range(start_block, end_block):
                    # Check doctor not booked
                    doc_booked = db.query(CalendarSlot).filter(
                        CalendarSlot.entity_type == "doctor",
                        CalendarSlot.entity_id == doc.doctor_id,
                        CalendarSlot.date == check_date,
                        CalendarSlot.time_block == block,
                        CalendarSlot.booked == True,
                    ).first()

                    room_booked = db.query(CalendarSlot).filter(
                        CalendarSlot.entity_type == "room",
                        CalendarSlot.entity_id == room.room_id,
                        CalendarSlot.date == check_date,
                        CalendarSlot.time_block == block,
                        CalendarSlot.booked == True,
                    ).first()

                    if not doc_booked and not room_booked:
                        slot_hour = DAY_START_HOUR + (block * SLOT_MINUTES) // 60
                        slot_min = (block * SLOT_MINUTES) % 60
                        end_block = block + 1  # 15-min emergency slot
                        end_hour = DAY_START_HOUR + (end_block * SLOT_MINUTES) // 60
                        end_min = (end_block * SLOT_MINUTES) % 60
                        return {
                            "type": "EMERGENCY",
                            "date": str(check_date),
                            "time": f"{slot_hour:02d}:{slot_min:02d}",
                            "end_time": f"{end_hour:02d}:{end_min:02d}",
                            "time_block": block,
                            "duration_minutes": 15,
                            "doctor_id": str(doc.doctor_id),
                            "doctor_name": doc.name,
                            "room_id": str(room.room_id),
                            "room_name": room.name,
                            "clinic_id": str(clinic_id),
                            "procedure": "Emergency Triage",
                            "score": 1000,
                        }

    return None
