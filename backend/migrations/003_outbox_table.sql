-- ==============================================================================
-- Migration: 003_outbox_table.sql
-- Description: Outbox pattern for asynchronous reliable side-effects
-- Target: Supabase / PostgreSQL 14+
-- ==============================================================================

CREATE TABLE IF NOT EXISTS outbox_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    job_type VARCHAR(50) NOT NULL CHECK (job_type IN ('CLASSROOM_INVITE', 'WELCOME_EMAIL', 'CLASSROOM_REMOVE')),
    payload JSONB NOT NULL DEFAULT '{}',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    locked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_outbox_payment_type UNIQUE (payment_id, job_type)
);

CREATE INDEX IF NOT EXISTS idx_outbox_pending ON outbox_jobs(status, next_run_at) WHERE status = 'PENDING';

CREATE OR REPLACE TRIGGER trg_outbox_jobs_updated_at
BEFORE UPDATE ON outbox_jobs
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

ALTER TABLE outbox_jobs ENABLE ROW LEVEL SECURITY;
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_outbox') THEN
        CREATE POLICY service_role_all_outbox ON outbox_jobs FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;
