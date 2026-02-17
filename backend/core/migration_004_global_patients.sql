-- ============================================================================
-- Migration 004: Global Patients — make patients cross-clinic
-- Patients register globally; clinic is assigned at appointment booking time.
-- ============================================================================

-- 1. Make tenant_id nullable on patients
ALTER TABLE patients ALTER COLUMN tenant_id DROP NOT NULL;

-- 2. Drop per-tenant email unique constraint
ALTER TABLE patients DROP CONSTRAINT IF EXISTS unique_patient_email_per_tenant;

-- 3. Add global email unique constraint (each email can only exist once globally)
DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'unique_patient_email_global') THEN
        ALTER TABLE patients ADD CONSTRAINT unique_patient_email_global UNIQUE (email);
    END IF;
END $$;

-- 4. Update FK action from CASCADE to SET NULL
ALTER TABLE patients DROP CONSTRAINT IF EXISTS patients_tenant_id_fkey;
ALTER TABLE patients ADD CONSTRAINT patients_tenant_id_fkey
    FOREIGN KEY (tenant_id) REFERENCES clinics(clinic_id) ON DELETE SET NULL;
