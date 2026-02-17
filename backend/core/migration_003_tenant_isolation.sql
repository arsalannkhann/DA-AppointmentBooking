-- ============================================================================
-- Migration 003: Tenant Isolation — Add tenant_id where missing
-- ============================================================================

-- 1. clinics: add onboarding_complete if missing
ALTER TABLE clinics ADD COLUMN IF NOT EXISTS onboarding_complete BOOLEAN DEFAULT FALSE;

-- 2. doctors: add tenant_id if missing
ALTER TABLE doctors ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_doctors_tenant ON doctors (tenant_id);

-- 3. specializations: add tenant_id if missing
ALTER TABLE specializations ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
-- Drop old global unique constraint and add per-tenant
ALTER TABLE specializations DROP CONSTRAINT IF EXISTS specializations_name_key;
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_spec_per_tenant') THEN
        ALTER TABLE specializations ADD CONSTRAINT unique_spec_per_tenant UNIQUE (tenant_id, name);
    END IF;
END $$;
CREATE INDEX IF NOT EXISTS idx_specs_tenant ON specializations (tenant_id);

-- 4. staff: add tenant_id if missing
ALTER TABLE staff ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_staff_tenant ON staff (tenant_id);

-- 5. patients: add tenant_id if missing
ALTER TABLE patients ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
ALTER TABLE patients ADD COLUMN IF NOT EXISTS hashed_password TEXT;
CREATE INDEX IF NOT EXISTS idx_patients_tenant ON patients (tenant_id);

-- Deduplicate patients with same (tenant_id, email) before adding unique constraint
-- Keep the most recently created patient, delete older duplicates
DELETE FROM patients p1
USING patients p2
WHERE p1.tenant_id = p2.tenant_id
  AND p1.email = p2.email
  AND p1.email IS NOT NULL
  AND p1.created_at < p2.created_at;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_patient_email_per_tenant') THEN
        ALTER TABLE patients ADD CONSTRAINT unique_patient_email_per_tenant UNIQUE (tenant_id, email);
    END IF;
END $$;

-- 6. procedures: add tenant_id if missing
ALTER TABLE procedures ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_procedures_tenant ON procedures (tenant_id);

-- 7. calendar_slots: add tenant_id
ALTER TABLE calendar_slots ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_cal_tenant ON calendar_slots (tenant_id);

-- 8. Backfill calendar_slots.tenant_id from linked appointments
UPDATE calendar_slots cs
SET tenant_id = a.clinic_id
FROM appointments a
WHERE cs.appt_id = a.appt_id
  AND cs.tenant_id IS NULL;

-- 9. patient_settings: add tenant_id if missing
ALTER TABLE patient_settings ADD COLUMN IF NOT EXISTS tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
CREATE INDEX IF NOT EXISTS idx_patient_settings_tenant ON patient_settings (tenant_id);

-- 10. appointments: add tenant_id index
CREATE INDEX IF NOT EXISTS idx_appt_clinic ON appointments (clinic_id);

-- 11. rooms: add tenant_id index
CREATE INDEX IF NOT EXISTS idx_rooms_clinic ON rooms (clinic_id);
