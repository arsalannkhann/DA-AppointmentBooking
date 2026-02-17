-- Migration 002: Add Patient Auth Support
-- 1. Add hashed_password column to patients table
ALTER TABLE patients ADD COLUMN IF NOT EXISTS hashed_password TEXT;

-- 2. Add Unique Constraint on (tenant_id, email) for patients to prevent duplicates within a clinic
-- Note: Check if constraint already exists or if index exists.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'unique_patient_email_per_tenant'
    ) THEN
        ALTER TABLE patients ADD CONSTRAINT unique_patient_email_per_tenant UNIQUE (tenant_id, email);
    END IF;
END $$;
