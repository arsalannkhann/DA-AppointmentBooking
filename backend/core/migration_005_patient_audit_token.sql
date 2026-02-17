-- ============================================================================
-- Migration 005: Add patient_id to audit_logs and token_blacklist
-- Required for patient auth flows (registration, login, logout).
-- ============================================================================

-- 1. Add patient_id column to bronn_audit_logs
ALTER TABLE bronn_audit_logs
    ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(patient_id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_bronn_audit_patient ON bronn_audit_logs(patient_id);

-- 2. Add patient_id column to bronn_token_blacklist
ALTER TABLE bronn_token_blacklist
    ADD COLUMN IF NOT EXISTS patient_id UUID REFERENCES patients(patient_id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_bronn_blacklist_patient ON bronn_token_blacklist(patient_id);
