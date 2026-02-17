"""
Seed script — populates the database with realistic reference data.
Run:  python -m core.seed
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from datetime import time, date, timedelta
from core.db import get_db, deploy_schema
from models.models import (
    Clinic, Room, Doctor, Specialization, DoctorSpecialization,
    Staff, Procedure, AvailabilityTemplate, DoctorAvailability,
)


def seed():
    """Insert reference data — idempotent."""
    with get_db() as db:
        if db.query(Clinic).first():
            print("⏩  Data already seeded — skipping.")
            return

        # ── Clinics ───────────────────────────────────────────────────
        downtown = Clinic(
            name="Downtown Dental",
            address="123 Main Street, Mumbai",
            location="Downtown",
            settings={"opening_hour": 9, "closing_hour": 17},
        )
        westside = Clinic(
            name="Westside Oral Surgery",
            address="456 West Avenue, Mumbai",
            location="Westside",
            settings={"opening_hour": 9, "closing_hour": 17},
        )
        db.add_all([downtown, westside])
        db.flush()

        # ── Rooms ─────────────────────────────────────────────────────
        room1 = Room(
            clinic_id=downtown.clinic_id,
            name="Room 1 — General Operatory",
            type="operatory",
            capabilities={"type": "operatory", "xray": True, "microscope": False, "sedation_support": False},
            equipment=["dental_chair", "xray_unit"],
            sedation_capable=False,
        )
        room2 = Room(
            clinic_id=downtown.clinic_id,
            name="Room 2 — Endo Suite (Microscope)",
            type="endo",
            capabilities={"type": "operatory", "xray": True, "microscope": True, "sedation_support": False},
            equipment=["dental_chair", "microscope", "xray_unit", "apex_locator"],
            sedation_capable=False,
        )
        room3 = Room(
            clinic_id=westside.clinic_id,
            name="Room 3 — General Operatory",
            type="operatory",
            capabilities={"type": "operatory", "xray": True, "microscope": False, "sedation_support": False},
            equipment=["dental_chair", "xray_unit"],
            sedation_capable=False,
        )
        room4 = Room(
            clinic_id=westside.clinic_id,
            name="Room 4 — Surgical Suite",
            type="surgical",
            capabilities={"type": "surgical", "xray": True, "microscope": False, "sedation_support": True, "surgical": True},
            equipment=["surgical_chair", "xray_unit", "sedation_unit", "surgical_instruments"],
            sedation_capable=True,
        )
        db.add_all([room1, room2, room3, room4])
        db.flush()

        # ── Specializations ───────────────────────────────────────────
        spec_gd   = Specialization(tenant_id=downtown.clinic_id, name="General Dentist")
        spec_endo = Specialization(tenant_id=downtown.clinic_id, name="Endodontist")
        spec_os   = Specialization(tenant_id=westside.clinic_id, name="Oral Surgeon")
        db.add_all([spec_gd, spec_endo, spec_os])
        db.flush()

        # ── Doctors ───────────────────────────────────────────────────
        dr_patel = Doctor(tenant_id=downtown.clinic_id, name="Dr. Priya Patel", npi="1111111111", email="patel@smartdental.com")
        dr_khan  = Doctor(tenant_id=downtown.clinic_id, name="Dr. Amir Khan",   npi="2222222222", email="khan@smartdental.com")
        dr_rao   = Doctor(tenant_id=westside.clinic_id, name="Dr. Sunita Rao",  npi="3333333333", email="rao@smartdental.com")
        dr_shah  = Doctor(tenant_id=westside.clinic_id, name="Dr. Vikram Shah",  npi="4444444444", email="shah@smartdental.com")
        db.add_all([dr_patel, dr_khan, dr_rao, dr_shah])
        db.flush()

        db.add_all([
            DoctorSpecialization(doctor_id=dr_patel.doctor_id, spec_id=spec_gd.spec_id),
            DoctorSpecialization(doctor_id=dr_khan.doctor_id,  spec_id=spec_endo.spec_id),
            DoctorSpecialization(doctor_id=dr_khan.doctor_id,  spec_id=spec_gd.spec_id),
            DoctorSpecialization(doctor_id=dr_rao.doctor_id,   spec_id=spec_os.spec_id),
            DoctorSpecialization(doctor_id=dr_shah.doctor_id,  spec_id=spec_gd.spec_id),
            DoctorSpecialization(doctor_id=dr_shah.doctor_id,  spec_id=spec_os.spec_id),
        ])
        db.flush()

        # ── Staff ─────────────────────────────────────────────────────
        anesthetist = Staff(tenant_id=westside.clinic_id, name="Dr. Meera Gupta", role="Anesthetist")
        db.add(anesthetist)
        db.flush()

        # ── Procedures ────────────────────────────────────────────────
        procs = [
            Procedure(tenant_id=downtown.clinic_id, name="Emergency Triage", base_duration_minutes=15,
                      consult_duration_minutes=0, required_spec_id=spec_gd.spec_id,
                      requires_anesthetist=False, allow_same_day_combo=False),
            Procedure(tenant_id=downtown.clinic_id, name="Root Canal Consult", base_duration_minutes=20,
                      consult_duration_minutes=0, required_spec_id=spec_endo.spec_id,
                      required_room_capability={"microscope": True},
                      requires_anesthetist=False, allow_same_day_combo=True),
            Procedure(tenant_id=downtown.clinic_id, name="Root Canal Treatment", base_duration_minutes=90,
                      consult_duration_minutes=20, required_spec_id=spec_endo.spec_id,
                      required_room_capability={"microscope": True},
                      requires_anesthetist=False, allow_same_day_combo=True),
            Procedure(tenant_id=westside.clinic_id, name="Oral Surgery Consult", base_duration_minutes=15,
                      consult_duration_minutes=0, required_spec_id=spec_os.spec_id,
                      required_room_capability={"surgical": True},
                      requires_anesthetist=False, allow_same_day_combo=True),
            Procedure(tenant_id=westside.clinic_id, name="Wisdom Tooth Extraction (Sedation)", base_duration_minutes=75,
                      consult_duration_minutes=15, required_spec_id=spec_os.spec_id,
                      required_room_capability={"surgical": True},
                      requires_anesthetist=True, allow_same_day_combo=True),
            Procedure(tenant_id=downtown.clinic_id, name="General Checkup", base_duration_minutes=30,
                      consult_duration_minutes=0, required_spec_id=spec_gd.spec_id,
                      requires_anesthetist=False, allow_same_day_combo=False),
            Procedure(tenant_id=downtown.clinic_id, name="Dental Filling", base_duration_minutes=45,
                      consult_duration_minutes=15, required_spec_id=spec_gd.spec_id,
                      requires_anesthetist=False, allow_same_day_combo=True),
            Procedure(tenant_id=downtown.clinic_id, name="Dental Crown", base_duration_minutes=60,
                      consult_duration_minutes=20, required_spec_id=spec_gd.spec_id,
                      requires_anesthetist=False, allow_same_day_combo=True),
        ]
        db.add_all(procs)
        db.flush()

        # ── Availability Templates (weekly recurring) ─────────────────
        # Dr. Patel (GD) — Mon-Fri at Downtown
        for dow in range(5):
            db.add(AvailabilityTemplate(
                resource_id=dr_patel.doctor_id, resource_type="DOCTOR",
                clinic_id=downtown.clinic_id, day_of_week=dow,
                start_time=time(9, 0), end_time=time(17, 0),
            ))

        # Dr. Khan (Endodontist) — Mon/Wed/Fri at Downtown
        for dow in [0, 2, 4]:
            db.add(AvailabilityTemplate(
                resource_id=dr_khan.doctor_id, resource_type="DOCTOR",
                clinic_id=downtown.clinic_id, day_of_week=dow,
                start_time=time(9, 0), end_time=time(17, 0),
            ))

        # Dr. Rao (Oral Surgeon) — Tue/Thu at Westside
        for dow in [1, 3]:
            db.add(AvailabilityTemplate(
                resource_id=dr_rao.doctor_id, resource_type="DOCTOR",
                clinic_id=westside.clinic_id, day_of_week=dow,
                start_time=time(9, 0), end_time=time(17, 0),
            ))

        # Dr. Shah (GD + OS) — Mon/Wed at Westside, Tue/Thu at Downtown
        for dow in [0, 2]:
            db.add(AvailabilityTemplate(
                resource_id=dr_shah.doctor_id, resource_type="DOCTOR",
                clinic_id=westside.clinic_id, day_of_week=dow,
                start_time=time(9, 0), end_time=time(17, 0),
            ))
        for dow in [1, 3]:
            db.add(AvailabilityTemplate(
                resource_id=dr_shah.doctor_id, resource_type="DOCTOR",
                clinic_id=downtown.clinic_id, day_of_week=dow,
                start_time=time(9, 0), end_time=time(17, 0),
            ))

        # Anesthetist — Tue/Thu at Westside
        for dow in [1, 3]:
            db.add(AvailabilityTemplate(
                resource_id=anesthetist.staff_id, resource_type="STAFF",
                clinic_id=westside.clinic_id, day_of_week=dow,
                start_time=time(9, 0), end_time=time(17, 0),
            ))

        db.flush()
        # Seed data inserted.


if __name__ == "__main__":
    # Schema deployed.
    seed()
    # Database ready!
