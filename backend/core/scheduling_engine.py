from __future__ import annotations
"""
Scheduling Engine — 15-minute grid constraint solver with multi-resource
intersection (Doctor ∩ Room ∩ Anesthetist) and One-Stop-Shop combo search.
All queries are tenant-scoped.
"""
import math
from datetime import date, datetime, timedelta, time as dt_time
from dataclasses import dataclass, asdict, field
from typing import Optional
from uuid import UUID as PyUUID
from sqlalchemy.orm import Session
from models.models import (
    Doctor, Room, Staff, AvailabilityTemplate, Appointment,
    CalendarSlot, DoctorSpecialization, Procedure,
)
from config import (
    DAY_START_HOUR, DAY_END_HOUR, SLOT_MINUTES, SLOTS_PER_DAY,
    BUFFER_SLOTS, SCHEDULE_LOOKAHEAD_DAYS,
)


class SlotUnavailableError(Exception):
    """Raised when a calendar slot is already booked."""
    pass


@dataclass
class SlotOption:
    type: str              # COMBO, CONSULT_ONLY, SINGLE
    date: str
    time: str
    end_time: str
    time_block: int
    duration_minutes: int
    doctor_id: str
    doctor_name: str
    room_id: str
    room_name: str
    clinic_id: str
    clinic_name: str = ""
    staff_id: str | None = None
    staff_name: str | None = None
    procedure: str = ""
    consult_end_time: str | None = None
    treatment_start_time: str | None = None
    score: float = 0

    def to_dict(self):
        return asdict(self)


def _blocks_needed(minutes: int) -> int:
    """Round UP to nearest 15-min block."""
    return math.ceil(minutes / SLOT_MINUTES)


def _block_to_time(block: int) -> str:
    """Convert block index to HH:MM."""
    total_min = DAY_START_HOUR * 60 + block * SLOT_MINUTES
    return f"{total_min // 60:02d}:{total_min % 60:02d}"


def _get_availability_mask(
    db: Session,
    entity_type: str,
    entity_id,
    target_date: date,
    templates: list[AvailabilityTemplate],
) -> list[bool]:
    """
    Returns a boolean mask [True = free, False = busy] for the day.
    """
    mask = [False] * SLOTS_PER_DAY
    dow = target_date.weekday()

    # Apply templates
    for tmpl in templates:
        if tmpl.day_of_week != dow:
            continue
        start_block = max(0, (tmpl.start_time.hour - DAY_START_HOUR) * (60 // SLOT_MINUTES)
                         + tmpl.start_time.minute // SLOT_MINUTES)
        end_block = min(SLOTS_PER_DAY, (tmpl.end_time.hour - DAY_START_HOUR) * (60 // SLOT_MINUTES))
        for b in range(start_block, end_block):
            mask[b] = True

    # Remove booked blocks from CalendarSlots
    booked = (
        db.query(CalendarSlot)
        .filter(
            CalendarSlot.entity_type == entity_type,
            CalendarSlot.entity_id == entity_id,
            CalendarSlot.date == target_date,
            CalendarSlot.booked == True,
        )
        .all()
    )
    for slot in booked:
        if 0 <= slot.time_block < SLOTS_PER_DAY:
            mask[slot.time_block] = False

    return mask


def _find_contiguous(mask: list[bool], length: int) -> list[int]:
    """Find all starting positions with 'length' contiguous True values."""
    starts = []
    run = 0
    for i, free in enumerate(mask):
        if free:
            run += 1
            if run >= length:
                starts.append(i - length + 1)
        else:
            run = 0
    return starts


def find_slots(
    db: Session,
    procedure: Procedure,
    needs_sedation: bool = False,
    preferred_clinic_id: str | None = None,
    *,
    tenant_id: PyUUID | None = None,
) -> list[SlotOption]:
    """
    Main scheduling algorithm. Finds valid time slots satisfying all constraints:
    - Doctor with correct specialization (tenant-scoped)
    - Room with required capabilities at same clinic (tenant-scoped)
    - Anesthetist (if sedation needed) (tenant-scoped)
    - Contiguous blocks for combo (consult + treatment)

    tenant_id: If provided, all queries are scoped to this tenant.
    """
    results: list[SlotOption] = []
    today = date.today()

    # Calculate block requirements
    treatment_blocks = _blocks_needed(procedure.base_duration_minutes)
    consult_blocks = _blocks_needed(procedure.consult_duration_minutes) if procedure.consult_duration_minutes > 0 else 0
    combo_blocks = consult_blocks + BUFFER_SLOTS + treatment_blocks if consult_blocks > 0 else treatment_blocks
    single_blocks = consult_blocks if consult_blocks > 0 else treatment_blocks

    # Get candidate doctors — TENANT SCOPED
    doctor_query = (
        db.query(Doctor)
        .join(DoctorSpecialization)
        .filter(DoctorSpecialization.spec_id == procedure.required_spec_id)
        .filter(Doctor.active == True)
    )
    if tenant_id:
        doctor_query = doctor_query.filter(Doctor.tenant_id == tenant_id)
    candidate_doctors = doctor_query.all()

    # Get all rooms — TENANT SCOPED
    room_query = db.query(Room).filter(Room.status == "active")
    if tenant_id:
        room_query = room_query.filter(Room.clinic_id == tenant_id)
    all_rooms = room_query.all()

    # Filter rooms by capability
    required_caps = procedure.required_room_capability or {}
    candidate_rooms = [
        r for r in all_rooms
        if all(r.capabilities.get(k) == v for k, v in required_caps.items())
    ]

    # Get anesthetist if needed — TENANT SCOPED
    anesthetist = None
    if needs_sedation or procedure.requires_anesthetist:
        staff_query = db.query(Staff).filter(Staff.role == "Anesthetist")
        if tenant_id:
            staff_query = staff_query.filter(Staff.tenant_id == tenant_id)
        anesthetist = staff_query.first()
        if not anesthetist:
            return []  # Can't proceed without anesthetist

    # Pre-load all templates
    doc_templates = {}
    for doc in candidate_doctors:
        doc_templates[doc.doctor_id] = (
            db.query(AvailabilityTemplate)
            .filter(
                AvailabilityTemplate.resource_id == doc.doctor_id,
                AvailabilityTemplate.resource_type == "DOCTOR",
            )
            .all()
        )

    anesth_templates = []
    if anesthetist:
        anesth_templates = (
            db.query(AvailabilityTemplate)
            .filter(
                AvailabilityTemplate.resource_id == anesthetist.staff_id,
                AvailabilityTemplate.resource_type == "STAFF",
            )
            .all()
        )

    # Search across lookahead days
    for day_offset in range(1, SCHEDULE_LOOKAHEAD_DAYS + 1):
        target = today + timedelta(days=day_offset)
        if target.weekday() >= 5:  # Skip weekends
            continue

        for doc in candidate_doctors:
            templates = doc_templates.get(doc.doctor_id, [])
            if not templates:
                continue

            # Determine which clinic this doctor is at today
            doc_clinics = set()
            for tmpl in templates:
                if tmpl.day_of_week == target.weekday():
                    doc_clinics.add(tmpl.clinic_id)

            for clinic_id in doc_clinics:
                # Filter rooms at THIS clinic only
                local_rooms = [r for r in candidate_rooms if r.clinic_id == clinic_id]
                if not local_rooms:
                    continue

                # Get doctor mask
                clinic_templates = [t for t in templates if t.clinic_id == clinic_id]
                doc_mask = _get_availability_mask(db, "doctor", doc.doctor_id, target, clinic_templates)

                for room in local_rooms:
                    # Create a "dummy" template for room (rooms are available all day)
                    room_mask = [True] * SLOTS_PER_DAY
                    # Check booked slots
                    booked = (
                        db.query(CalendarSlot)
                        .filter(
                            CalendarSlot.entity_type == "room",
                            CalendarSlot.entity_id == room.room_id,
                            CalendarSlot.date == target,
                            CalendarSlot.booked == True,
                        )
                        .all()
                    )
                    for s in booked:
                        if 0 <= s.time_block < SLOTS_PER_DAY:
                            room_mask[s.time_block] = False

                    # Intersect masks
                    combined = [d and r for d, r in zip(doc_mask, room_mask)]

                    # Add anesthetist constraint if needed
                    if anesthetist:
                        anesth_clinic_templates = [t for t in anesth_templates if t.clinic_id == clinic_id]
                        if not anesth_clinic_templates:
                            continue
                        anesth_mask = _get_availability_mask(db, "staff", anesthetist.staff_id, target, anesth_clinic_templates)
                        combined = [c and a for c, a in zip(combined, anesth_mask)]

                    # Search for COMBO blocks first (One-Stop-Shop)
                    if procedure.allow_same_day_combo and consult_blocks > 0:
                        combo_starts = _find_contiguous(combined, combo_blocks)
                        for start in combo_starts:
                            consult_end = start + consult_blocks
                            treat_start = consult_end + BUFFER_SLOTS
                            results.append(SlotOption(
                                type="COMBO",
                                date=str(target),
                                time=_block_to_time(start),
                                end_time=_block_to_time(start + combo_blocks),
                                time_block=start,
                                duration_minutes=combo_blocks * SLOT_MINUTES,
                                doctor_id=str(doc.doctor_id),
                                doctor_name=doc.name,
                                room_id=str(room.room_id),
                                room_name=room.name,
                                clinic_id=str(clinic_id),
                                staff_id=str(anesthetist.staff_id) if anesthetist else None,
                                staff_name=anesthetist.name if anesthetist else None,
                                procedure=procedure.name,
                                consult_end_time=_block_to_time(consult_end),
                                treatment_start_time=_block_to_time(treat_start),
                                score=100,
                            ))

                    # Search for single blocks (consult-only or standalone)
                    single_starts = _find_contiguous(combined, single_blocks)
                    for start in single_starts:
                        slot_type = "CONSULT_ONLY" if consult_blocks > 0 else "SINGLE"
                        results.append(SlotOption(
                            type=slot_type,
                            date=str(target),
                            time=_block_to_time(start),
                            end_time=_block_to_time(start + single_blocks),
                            time_block=start,
                            duration_minutes=single_blocks * SLOT_MINUTES,
                            doctor_id=str(doc.doctor_id),
                            doctor_name=doc.name,
                            room_id=str(room.room_id),
                            room_name=room.name,
                            clinic_id=str(clinic_id),
                            staff_id=str(anesthetist.staff_id) if anesthetist else None,
                            staff_name=anesthetist.name if anesthetist else None,
                            procedure=procedure.name,
                            score=50,
                        ))

    return results


def book_appointment(
    db: Session,
    slot: dict,
    patient_id: str,
    proc_id: int | None = None,
    *,
    tenant_id: PyUUID | None = None,
) -> dict:
    """Book an appointment and lock CalendarSlots. All slots tagged with tenant_id."""
    from uuid import UUID
    from models.models import Appointment

    target_date = date.fromisoformat(slot["date"])
    start_block = slot["time_block"]
    num_blocks = _blocks_needed(slot["duration_minutes"])

    # Parse start time
    start_parts = slot["time"].split(":")
    start_dt = datetime.combine(target_date, dt_time(int(start_parts[0]), int(start_parts[1])))

    # Parse end time — compute from start + duration if missing
    if slot.get("end_time"):
        end_parts = slot["end_time"].split(":")
        end_dt = datetime.combine(target_date, dt_time(int(end_parts[0]), int(end_parts[1])))
    else:
        end_dt = start_dt + timedelta(minutes=slot["duration_minutes"])

    # Resolve clinic_id — use tenant_id if provided, otherwise from slot
    clinic_id = tenant_id or UUID(slot["clinic_id"])

    # Create appointment
    appt = Appointment(
        patient_id=UUID(patient_id),
        doctor_id=UUID(slot["doctor_id"]),
        room_id=UUID(slot["room_id"]),
        staff_id=UUID(slot["staff_id"]) if slot.get("staff_id") else None,
        clinic_id=clinic_id,
        proc_id=proc_id,
        procedure_type=slot.get("procedure", ""),
        start_time=start_dt,
        end_time=end_dt,
        status="SCHEDULED",
    )
    db.add(appt)
    db.flush()

    # Lock calendar slots for doctor, room, and staff — tagged with tenant_id
    entities = [
        ("doctor", slot["doctor_id"]),
        ("room", slot["room_id"]),
    ]
    if slot.get("staff_id"):
        entities.append(("staff", slot["staff_id"]))

    # Pre-validate: ensure all needed blocks are free before inserting
    for entity_type, entity_id in entities:
        conflict = (
            db.query(CalendarSlot)
            .filter(
                CalendarSlot.entity_type == entity_type,
                CalendarSlot.entity_id == UUID(entity_id),
                CalendarSlot.date == target_date,
                CalendarSlot.time_block.in_(range(start_block, start_block + num_blocks)),
                CalendarSlot.booked == True,
            )
            .first()
        )
        if conflict:
            raise SlotUnavailableError(
                f"Time slot already booked for {entity_type} on {target_date} "
                f"(block {conflict.time_block})"
            )

    for entity_type, entity_id in entities:
        for block in range(start_block, start_block + num_blocks):
            # UPSERT logic: check for existing slot first
            existing_slot = (
                db.query(CalendarSlot)
                .filter(
                    CalendarSlot.entity_type == entity_type,
                    CalendarSlot.entity_id == UUID(entity_id),
                    CalendarSlot.date == target_date,
                    CalendarSlot.time_block == block,
                )
                .first()
            )

            if existing_slot:
                existing_slot.booked = True
                existing_slot.appt_id = appt.appt_id
                if tenant_id:
                    existing_slot.tenant_id = tenant_id
            else:
                cs = CalendarSlot(
                    tenant_id=tenant_id,
                    entity_type=entity_type,
                    entity_id=UUID(entity_id),
                    date=target_date,
                    time_block=block,
                    booked=True,
                    appt_id=appt.appt_id,
                )
                db.add(cs)

    db.flush()

    return {
        "appt_id": str(appt.appt_id),
        "start_time": str(appt.start_time),
        "end_time": str(appt.end_time),
        "doctor": slot["doctor_name"],
        "room": slot["room_name"],
        "status": "SCHEDULED",
    }
