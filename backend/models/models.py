"""
SQLAlchemy ORM models for the Dental Appointment Orchestration System.
Includes multi-tenant auth models.
"""
import uuid
from datetime import datetime, date, time
from sqlalchemy import (
    Column, String, Integer, Boolean, Text, Date, Time,
    DateTime, ForeignKey, CheckConstraint, UniqueConstraint,
)
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.orm import relationship
from core.db import Base


# ── AUTH MODELS ──────────────────────────────────────────────────────────────

class User(Base):
    __tablename__ = "bronn_users"
    id              = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id       = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id", ondelete="CASCADE"), nullable=False)
    email           = Column(String(255), nullable=False)
    hashed_password = Column(Text, nullable=False)
    full_name       = Column(String(255), nullable=False)
    role            = Column(String(20), nullable=False, default="staff")
    is_active       = Column(Boolean, default=True)
    is_deleted      = Column(Boolean, default=False)
    created_at      = Column(DateTime(timezone=True), default=datetime.utcnow)
    updated_at      = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    tenant = relationship("Clinic")
    __table_args__ = (
        CheckConstraint("role IN ('admin', 'doctor', 'staff')", name="check_user_role"),
        UniqueConstraint("tenant_id", "email", name="unique_email_per_tenant"),
    )


class AuditLog(Base):
    __tablename__ = "bronn_audit_logs"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id   = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id", ondelete="CASCADE"))
    user_id     = Column(UUID(as_uuid=True), ForeignKey("bronn_users.id", ondelete="SET NULL"))
    patient_id  = Column(UUID(as_uuid=True), ForeignKey("patients.patient_id", ondelete="SET NULL"))
    action      = Column(String(100), nullable=False)
    entity_type = Column(String(50))
    entity_id   = Column(String(255))
    details     = Column(JSONB, default={})
    ip_address  = Column(String(45))
    created_at  = Column(DateTime(timezone=True), default=datetime.utcnow)


class TokenBlacklist(Base):
    __tablename__ = "bronn_token_blacklist"
    id         = Column(Integer, primary_key=True, autoincrement=True)
    jti        = Column(String(255), unique=True, nullable=False)
    user_id    = Column(UUID(as_uuid=True), ForeignKey("bronn_users.id", ondelete="CASCADE"))
    patient_id = Column(UUID(as_uuid=True), ForeignKey("patients.patient_id", ondelete="CASCADE"))
    expires_at = Column(DateTime(timezone=True), nullable=False)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)


class LoginAttempt(Base):
    __tablename__ = "bronn_login_attempts"
    id            = Column(Integer, primary_key=True, autoincrement=True)
    email         = Column(String(255), nullable=False, unique=True)
    attempt_count = Column(Integer, default=1)
    last_attempt  = Column(DateTime(timezone=True), default=datetime.utcnow)
    locked_until  = Column(DateTime(timezone=True))


# ── BUSINESS MODELS ──────────────────────────────────────────────────────────

class Clinic(Base):
    __tablename__ = "clinics"
    clinic_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name      = Column(String(255), nullable=False)
    address   = Column(Text)
    location  = Column(String(100))
    timezone  = Column(String(50), default="Asia/Kolkata")
    settings  = Column(JSONB, default={})
    onboarding_complete = Column(Boolean, default=False)
    rooms = relationship("Room", back_populates="clinic")


class Room(Base):
    __tablename__ = "rooms"
    room_id         = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    clinic_id       = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id"))
    name            = Column(String(100), nullable=False)
    type            = Column(String(50), default="operatory")
    capabilities    = Column(JSONB, default={})
    equipment       = Column(JSONB, default=[])
    sedation_capable = Column(Boolean, default=False)
    status          = Column(String(20), default="active")
    clinic = relationship("Clinic", back_populates="rooms")

    def has_capability(self, cap: str) -> bool:
        return bool(self.capabilities and self.capabilities.get(cap))


class Doctor(Base):
    __tablename__ = "doctors"
    doctor_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id", ondelete="CASCADE"))
    name      = Column(String(255), nullable=False)
    npi       = Column(String(20), unique=True)
    email     = Column(String(255))
    active    = Column(Boolean, default=True)
    specializations = relationship("DoctorSpecialization", back_populates="doctor")


class Specialization(Base):
    __tablename__ = "specializations"
    spec_id   = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id", ondelete="CASCADE"))
    name      = Column(String(100))
    __table_args__ = (
        UniqueConstraint("tenant_id", "name", name="unique_spec_per_tenant"),
    )


class DoctorSpecialization(Base):
    __tablename__ = "doctor_specializations"
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.doctor_id"), primary_key=True)
    spec_id   = Column(Integer, ForeignKey("specializations.spec_id"), primary_key=True)
    doctor = relationship("Doctor", back_populates="specializations")
    spec   = relationship("Specialization")


class Staff(Base):
    __tablename__ = "staff"
    staff_id  = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id", ondelete="CASCADE"))
    name      = Column(String(255))
    role      = Column(String(50))


class Patient(Base):
    __tablename__ = "patients"
    patient_id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    tenant_id  = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id", ondelete="SET NULL"), nullable=True)
    name       = Column(String(255), nullable=False)
    phone      = Column(String(20))
    email      = Column(String(255))
    hashed_password = Column(Text, nullable=True)  # Nullable for existing patients or phone-only users
    dob        = Column(Date)
    is_new     = Column(Boolean, default=True)
    created_at = Column(DateTime(timezone=True), default=datetime.utcnow)
    __table_args__ = (
        UniqueConstraint("email", name="unique_patient_email_global"),
    )


class Procedure(Base):
    __tablename__ = "procedures"
    proc_id                  = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id                = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id", ondelete="CASCADE"))
    name                     = Column(String(100), nullable=False)
    base_duration_minutes    = Column(Integer, nullable=False)
    consult_duration_minutes = Column(Integer, default=0)
    required_spec_id         = Column(Integer, ForeignKey("specializations.spec_id"))
    required_room_capability = Column(JSONB)
    requires_anesthetist     = Column(Boolean, default=False)
    allow_same_day_combo     = Column(Boolean, default=True)
    spec = relationship("Specialization")


class DoctorAvailability(Base):
    __tablename__ = "doctor_availability"
    id        = Column(Integer, primary_key=True, autoincrement=True)
    doctor_id = Column(UUID(as_uuid=True), ForeignKey("doctors.doctor_id"))
    clinic_id = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id"))
    date      = Column(Date, nullable=False)
    start_time = Column(Time, nullable=False)
    end_time   = Column(Time, nullable=False)
    doctor = relationship("Doctor")
    clinic = relationship("Clinic")


class AvailabilityTemplate(Base):
    __tablename__ = "availability_templates"
    template_id   = Column(Integer, primary_key=True, autoincrement=True)
    resource_id   = Column(UUID(as_uuid=True), nullable=False)
    resource_type = Column(String(20), nullable=False)
    clinic_id     = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id"))
    day_of_week   = Column(Integer, nullable=False)
    start_time    = Column(Time, nullable=False)
    end_time      = Column(Time, nullable=False)


class Appointment(Base):
    __tablename__ = "appointments"
    appt_id        = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    patient_id     = Column(UUID(as_uuid=True), ForeignKey("patients.patient_id"))
    doctor_id      = Column(UUID(as_uuid=True), ForeignKey("doctors.doctor_id"))
    room_id        = Column(UUID(as_uuid=True), ForeignKey("rooms.room_id"))
    staff_id       = Column(UUID(as_uuid=True), ForeignKey("staff.staff_id"))
    clinic_id      = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id"))
    proc_id        = Column(Integer, ForeignKey("procedures.proc_id"))
    procedure_type = Column(String(100))
    start_time     = Column(DateTime(timezone=True), nullable=False)
    end_time       = Column(DateTime(timezone=True), nullable=False)
    status         = Column(String(20), default="SCHEDULED")
    linked_appt_id = Column(UUID(as_uuid=True), ForeignKey("appointments.appt_id"))
    created_at     = Column(DateTime(timezone=True), default=datetime.utcnow)
    patient   = relationship("Patient")
    doctor    = relationship("Doctor")
    room      = relationship("Room")
    staff_member = relationship("Staff")
    clinic    = relationship("Clinic")
    procedure = relationship("Procedure")
    __table_args__ = (
        CheckConstraint("end_time > start_time", name="check_time_validity"),
    )


class CalendarSlot(Base):
    __tablename__ = "calendar_slots"
    id          = Column(Integer, primary_key=True, autoincrement=True)
    tenant_id   = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id", ondelete="CASCADE"), nullable=True)
    entity_type = Column(String(20), nullable=False)
    entity_id   = Column(UUID(as_uuid=True), nullable=False)
    date        = Column(Date, nullable=False)
    time_block  = Column(Integer, nullable=False)
    booked      = Column(Boolean, default=False)
    appt_id     = Column(UUID(as_uuid=True), ForeignKey("appointments.appt_id"))
    __table_args__ = (
        UniqueConstraint("entity_type", "entity_id", "date", "time_block"),
    )


class PatientSettings(Base):
    __tablename__ = "patient_settings"
    patient_id    = Column(UUID(as_uuid=True), ForeignKey("patients.patient_id"), primary_key=True)
    tenant_id     = Column(UUID(as_uuid=True), ForeignKey("clinics.clinic_id", ondelete="CASCADE"))
    notifications = Column(Boolean, default=True)
    dark_mode     = Column(Boolean, default=True)
    language      = Column(String(20), default="en")
    updated_at    = Column(DateTime(timezone=True), default=datetime.utcnow, onupdate=datetime.utcnow)
    patient = relationship("Patient")
