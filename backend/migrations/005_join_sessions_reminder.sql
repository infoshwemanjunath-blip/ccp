-- ==============================================================================
-- Migration: 005_join_sessions_reminder.sql
-- Description: Join session resumption & reminder tracking
-- Target: Supabase / PostgreSQL 14+
-- NOTE: In this codebase, the orders table is `payments` (keyed by razorpay_order_id).
-- Additive only. Nothing is dropped. Safe to re-run.
-- ==============================================================================

-- 1. New columns on payments (orders) table
ALTER TABLE payments ADD COLUMN IF NOT EXISTS classroom_opened_at TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS joined_confirmed_at TIMESTAMPTZ;

-- If a standalone orders table exists, add columns there too
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'orders') THEN
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS classroom_opened_at TIMESTAMPTZ;
        ALTER TABLE orders ADD COLUMN IF NOT EXISTS joined_confirmed_at TIMESTAMPTZ;
    END IF;
END $$;

-- 2. New table join_sessions
CREATE TABLE IF NOT EXISTS join_sessions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    last_seen_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    revoked_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_join_sessions_token_hash ON join_sessions(token_hash);
CREATE INDEX IF NOT EXISTS idx_join_sessions_order_id ON join_sessions(order_id);
CREATE INDEX IF NOT EXISTS idx_join_sessions_active ON join_sessions(order_id, expires_at) WHERE revoked_at IS NULL;

-- Enable RLS with NO policies so only service_role (backend) has access
ALTER TABLE join_sessions ENABLE ROW LEVEL SECURITY;

-- 3. New view pending_joins
-- Shows paid orders where joined_confirmed_at is null, with customer name, masked phone, paid_at and classroom_opened_at
CREATE OR REPLACE VIEW pending_joins AS
SELECT
    p.id AS order_id,
    p.razorpay_order_id,
    COALESCE(p.customer_name_submitted, l.full_name, 'Student') AS customer_name,
    CASE 
        WHEN COALESCE(p.customer_phone, l.phone) IS NOT NULL AND LENGTH(COALESCE(p.customer_phone, l.phone)) >= 6 THEN
            CONCAT(SUBSTRING(COALESCE(p.customer_phone, l.phone) FROM 1 FOR 4), '****', RIGHT(COALESCE(p.customer_phone, l.phone), 2))
        ELSE '****'
    END AS masked_phone,
    p.paid_at,
    p.classroom_opened_at
FROM payments p
LEFT JOIN leads l ON l.id = p.lead_id
WHERE p.status = 'PAID'
  AND p.joined_confirmed_at IS NULL;
