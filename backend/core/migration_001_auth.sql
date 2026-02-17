-- ============================================================================
-- Migration 001: Multi-Tenant Auth System (Bronn Namespace)
-- Defines 'bronn_' prefixed tables to avoid collision with legacy schema.
-- Adds 'tenant_id' to existing business tables safely.
-- ============================================================================

-- ── 1. AUTH TABLES (Bronn Namespace) ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS bronn_users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id       UUID NOT NULL REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    email           VARCHAR(255) NOT NULL,
    hashed_password TEXT NOT NULL,
    full_name       VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL DEFAULT 'staff',
    is_active       BOOLEAN DEFAULT TRUE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now(),
    CONSTRAINT check_bronn_role CHECK (role IN ('admin', 'doctor', 'staff')),
    CONSTRAINT unique_bronn_email_per_tenant UNIQUE (tenant_id, email)
);
CREATE INDEX IF NOT EXISTS idx_bronn_users_tenant ON bronn_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bronn_users_email ON bronn_users(email);

CREATE TABLE IF NOT EXISTS bronn_audit_logs (
    id           SERIAL PRIMARY KEY,
    tenant_id    UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE,
    user_id      UUID REFERENCES bronn_users(id) ON DELETE SET NULL,
    action       VARCHAR(100) NOT NULL,
    entity_type  VARCHAR(50),
    entity_id    VARCHAR(255),
    details      JSONB DEFAULT '{}',
    ip_address   VARCHAR(45),
    created_at   TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bronn_audit_tenant ON bronn_audit_logs(tenant_id);
CREATE INDEX IF NOT EXISTS idx_bronn_audit_user ON bronn_audit_logs(user_id);

CREATE TABLE IF NOT EXISTS bronn_token_blacklist (
    id          SERIAL PRIMARY KEY,
    jti         VARCHAR(255) UNIQUE NOT NULL,
    user_id     UUID REFERENCES bronn_users(id) ON DELETE CASCADE,
    expires_at  TIMESTAMPTZ NOT NULL,
    created_at  TIMESTAMPTZ DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_bronn_blacklist_jti ON bronn_token_blacklist(jti);

CREATE TABLE IF NOT EXISTS bronn_login_attempts (
    id             SERIAL PRIMARY KEY,
    email          VARCHAR(255) NOT NULL,
    attempt_count  INT DEFAULT 1,
    last_attempt   TIMESTAMPTZ DEFAULT now(),
    locked_until   TIMESTAMPTZ,
    CONSTRAINT unique_bronn_login_email UNIQUE (email)
);
CREATE INDEX IF NOT EXISTS idx_bronn_login_email ON bronn_login_attempts(email);


-- ── 2. BUSINESS TABLES Schema Evolution ─────────────────────────────────────
-- Safely add tenant_id to existing tables if missing

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='doctors' AND column_name='tenant_id') THEN
        ALTER TABLE doctors ADD COLUMN tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patients' AND column_name='tenant_id') THEN
        ALTER TABLE patients ADD COLUMN tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='staff' AND column_name='tenant_id') THEN
        ALTER TABLE staff ADD COLUMN tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='specializations' AND column_name='tenant_id') THEN
        ALTER TABLE specializations ADD COLUMN tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='procedures' AND column_name='tenant_id') THEN
        ALTER TABLE procedures ADD COLUMN tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='patient_settings' AND column_name='tenant_id') THEN
        ALTER TABLE patient_settings ADD COLUMN tenant_id UUID REFERENCES clinics(clinic_id) ON DELETE CASCADE;
    END IF;
END $$;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='clinics' AND column_name='onboarding_complete') THEN
        ALTER TABLE clinics ADD COLUMN onboarding_complete BOOLEAN DEFAULT FALSE;
    END IF;
END $$;

-- ── 3. BACKFILL tenant_id ──────────────────────────────────────────────────
-- Assign default tenant (first clinic) to orphaned rows
DO $$
DECLARE
    default_tenant UUID;
BEGIN
    SELECT clinic_id INTO default_tenant FROM clinics ORDER BY clinic_id LIMIT 1;
    IF default_tenant IS NOT NULL THEN
        UPDATE doctors SET tenant_id = default_tenant WHERE tenant_id IS NULL;
        UPDATE patients SET tenant_id = default_tenant WHERE tenant_id IS NULL;
        UPDATE staff SET tenant_id = default_tenant WHERE tenant_id IS NULL;
        UPDATE specializations SET tenant_id = default_tenant WHERE tenant_id IS NULL;
        UPDATE procedures SET tenant_id = default_tenant WHERE tenant_id IS NULL;
        UPDATE patient_settings SET tenant_id = default_tenant WHERE tenant_id IS NULL;
    END IF;
END $$;
