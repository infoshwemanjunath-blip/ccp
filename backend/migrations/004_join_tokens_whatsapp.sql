-- ==============================================================================
-- Migration: 004_join_tokens_whatsapp.sql
-- Description: Personal join page (phone-matched GCR link reveal) + WhatsApp invite tracking
-- Target: Supabase / PostgreSQL 14+
-- NOTE: In this codebase the "orders" table is `payments` (keyed by razorpay_order_id).
-- Additive only. Nothing is dropped. Safe to re-run.
-- ==============================================================================

-- 1. Paid phone snapshot per order (91XXXXXXXXXX). leads.phone keeps its existing 10-digit format.
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_phone VARCHAR(20);

-- 2. WhatsApp invite tracking
-- wa_status is added WITHOUT a default first so already-PAID historical orders stay NULL
-- and are never picked up by the retry job (only new registrations get WhatsApp).
ALTER TABLE payments ADD COLUMN IF NOT EXISTS wa_status VARCHAR(20);
ALTER TABLE payments ADD COLUMN IF NOT EXISTS wa_error TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS wa_attempts INTEGER NOT NULL DEFAULT 0;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chk_payments_wa_status') THEN
        ALTER TABLE payments ADD CONSTRAINT chk_payments_wa_status
            CHECK (wa_status IS NULL OR wa_status IN ('pending', 'sent', 'failed'));
    END IF;
END $$;

-- Orders that are still awaiting payment should get WhatsApp once they are paid
UPDATE payments SET wa_status = 'pending' WHERE wa_status IS NULL AND status = 'PENDING';

-- Every new order from now on starts as 'pending'
ALTER TABLE payments ALTER COLUMN wa_status SET DEFAULT 'pending';

-- 3. Join page access control (limits are per order, not per token)
ALTER TABLE payments ADD COLUMN IF NOT EXISTS join_failed_attempts INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS join_locked_until TIMESTAMPTZ;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS join_reveal_count INTEGER NOT NULL DEFAULT 0;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_name_submitted TEXT;
ALTER TABLE payments ADD COLUMN IF NOT EXISTS customer_email_submitted TEXT;

CREATE INDEX IF NOT EXISTS idx_payments_wa_retry
    ON payments (paid_at)
    WHERE status = 'PAID' AND wa_status IN ('pending', 'failed');

-- 4. Join tokens (only SHA-256 hashes are stored, never raw tokens)
CREATE TABLE IF NOT EXISTS join_tokens (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID NOT NULL REFERENCES payments(id) ON DELETE CASCADE,
    token_hash CHAR(64) NOT NULL UNIQUE,
    source VARCHAR(20) NOT NULL CHECK (source IN ('site', 'whatsapp')),
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_join_tokens_order_id ON join_tokens(order_id);

-- RLS on, deliberately NO policies: anon/authenticated roles get nothing.
-- The backend connects as the database owner / service role, which bypasses RLS.
ALTER TABLE join_tokens ENABLE ROW LEVEL SECURITY;
