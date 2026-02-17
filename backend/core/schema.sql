-- ============================================================================
-- Dental Appointment Orchestration System — PostgreSQL Schema
-- Multi-tenant isolation: every core table includes tenant_id (clinic_id)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";
CREATE EXTENSION IF NOT EXISTS "btree_gist";

-- ── 1. CLINICS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS clinics (
    clinic_id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                VARCHAR(255) NOT NULL,
    address             TEXT,
    location            VARCHAR(100),
    timezone            VARCHAR(50) DEFAULT 'Asia/Kolkata',
    settings            JSONB DEFAULT '{}',
    onboarding_complete BOOLEAN DEFAULT FALSE
);

-- ── 2. ROOMS ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS rooms (
    room_id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    clinic_id       UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    name            VARCHAR(100) NOT NULL,
    type            VARCHAR(50) NOT NULL DEFAULT 'operatory',
    capabilities    JSONB NOT NULL DEFAULT '{}',
    equipment       JSONB DEFAULT '[]',
    sedation_capable BOOLEAN DEFAULT FALSE,
    status          VARCHAR(20) DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_rooms_clinic ON rooms (clinic_id);
CREATE INDEX IF NOT EXISTS idx_room_caps ON rooms USING gin (capabilities);

-- ── 3. DOCTORS ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctors (
    doctor_id   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id   UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    npi         VARCHAR(20) UNIQUE,
    email       VARCHAR(255),
    active      BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_doctors_tenant ON doctors (tenant_id);

-- ── 4. SPECIALIZATIONS ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS specializations (
    spec_id   SERIAL PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    name      VARCHAR(100)
);
CREATE INDEX IF NOT EXISTS idx_specs_tenant ON specializations (tenant_id);
ALTER TABLE specializations DROP CONSTRAINT IF EXISTS specializations_name_key;
-- Unique per tenant, not globally
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spec_per_tenant') THEN
        ALTER TABLE specializations ADD CONSTRAINT unique_spec_per_tenant UNIQUE (tenant_id, name);
    END IF;
END $$;

CREATE TABLE IF NOT EXISTS doctor_specializations (
    doctor_id UUID REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    spec_id   INT  REFERENCES specializations(spec_id) ON DELETE CASCADE,
    PRIMARY KEY (doctor_id, spec_id)
);

-- ── 5. STAFF ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS staff (
    staff_id  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    name      VARCHAR(255),
    role      VARCHAR(50)
);
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff (tenant_id);

-- ── 6. PATIENTS (Global — not tenant-bound) ─────────────────────────────────
CREATE TABLE IF NOT EXISTS patients (
    patient_id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID REFERENCES clinics(clinic_id) ON DELETE SET NULL,  -- Nullable: patients are global
    name            VARCHAR(255) NOT NULL,
    phone           VARCHAR(20),
    email           VARCHAR(255) UNIQUE,  -- Global unique — one account per email
    hashed_password TEXT,
    dob             DATE,
    is_new          BOOLEAN DEFAULT TRUE,
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patients_tenant ON patients (tenant_id);

-- ── 7. PROCEDURES ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS procedures (
    proc_id                  SERIAL PRIMARY KEY,
    tenant_id                UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    name                     VARCHAR(100) NOT NULL,
    base_duration_minutes    INT NOT NULL,
    consult_duration_minutes INT DEFAULT 0,
    required_spec_id         INT REFERENCES specializations(spec_id),
    required_room_capability JSONB,
    requires_anesthetist     BOOLEAN DEFAULT FALSE,
    allow_same_day_combo     BOOLEAN DEFAULT TRUE
);
CREATE INDEX IF NOT EXISTS idx_procedures_tenant ON procedures (tenant_id);

-- ── 8. DOCTOR AVAILABILITY ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS doctor_availability (
    id          SERIAL PRIMARY KEY,
    doctor_id   UUID REFERENCES doctors(doctor_id) ON DELETE CASCADE,
    clinic_id   UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    date        DATE NOT NULL,
    start_time  TIME NOT NULL,
    end_time    TIME NOT NULL
);

-- ── 9. AVAILABILITY TEMPLATES (recurring weekly) ───────────────────────────
CREATE TABLE IF NOT EXISTS availability_templates (
    template_id   SERIAL PRIMARY KEY,
    resource_id   UUID NOT NULL,
    resource_type VARCHAR(20) NOT NULL,
    clinic_id     UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    day_of_week   INT NOT NULL,
    start_time    TIME NOT NULL,
    end_time      TIME NOT NULL,
    CHECK (resource_type IN ('DOCTOR', 'STAFF')),
    CHECK (day_of_week BETWEEN 0 AND 6),
    CHECK (end_time > start_time)
);

-- ── 10. APPOINTMENTS ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS appointments (
    appt_id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    patient_id     UUID REFERENCES patients(patient_id),
    doctor_id      UUID REFERENCES doctors(doctor_id),
    room_id        UUID REFERENCES rooms(room_id),
    staff_id       UUID REFERENCES staff(staff_id),
    clinic_id      UUID NOT NULL REFERENCES clinics(clinic_id),
    proc_id        INT  REFERENCES procedures(proc_id),
    procedure_type VARCHAR(100),
    start_time     TIMESTAMP WITH TIME ZONE NOT NULL,
    end_time       TIMESTAMP WITH TIME ZONE NOT NULL,
    status         VARCHAR(20) DEFAULT 'SCHEDULED',
    linked_appt_id UUID REFERENCES appointments(appt_id),
    created_at     TIMESTAMP WITH TIME ZONE DEFAULT now(),
    CONSTRAINT check_time_validity CHECK (end_time > start_time)
);
CREATE INDEX IF NOT EXISTS idx_appt_clinic  ON appointments (clinic_id);
CREATE INDEX IF NOT EXISTS idx_appt_doctor  ON appointments (doctor_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appt_room    ON appointments (room_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appt_staff   ON appointments (staff_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_appt_patient ON appointments (patient_id);

-- ── 11. CALENDAR SLOTS (15-min grid) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS calendar_slots (
    id           SERIAL PRIMARY KEY,
    tenant_id    UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    entity_type  VARCHAR(20) NOT NULL,  -- 'doctor', 'room', 'staff'
    entity_id    UUID NOT NULL,
    date         DATE NOT NULL,
    time_block   INT NOT NULL,          -- 0-31 (15-min blocks 09:00-17:00)
    booked       BOOLEAN DEFAULT FALSE,
    appt_id      UUID REFERENCES appointments(appt_id),
    UNIQUE(entity_type, entity_id, date, time_block)
);
CREATE INDEX IF NOT EXISTS idx_cal_entity ON calendar_slots (entity_type, entity_id, date);
CREATE INDEX IF NOT EXISTS idx_cal_tenant ON calendar_slots (tenant_id);

-- ── 12. PATIENT SETTINGS ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS patient_settings (
    patient_id       UUID PRIMARY KEY REFERENCES patients(patient_id) ON DELETE CASCADE,
    tenant_id        UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    notifications    BOOLEAN DEFAULT TRUE,
    dark_mode        BOOLEAN DEFAULT TRUE,
    language         VARCHAR(20) DEFAULT 'en',
    updated_at       TIMESTAMP WITH TIME ZONE DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_patient_settings_tenant ON patient_settings (tenant_id);
