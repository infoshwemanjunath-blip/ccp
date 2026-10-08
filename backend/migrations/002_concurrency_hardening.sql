-- ==============================================================================
-- Migration: 002_concurrency_hardening.sql
-- Description: Concurrency, Idempotency & Race-Condition Hardening
-- Target: Supabase / PostgreSQL 14+
-- Safe & Reversible
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. HARDEN LEADS TABLE
-- Add unique constraint on email_normalized (handling any pre-existing dupes first)
-- ------------------------------------------------------------------------------

-- Deduplicate pre-existing duplicate leads keeping the latest updated row
DELETE FROM leads l1
USING leads l2
WHERE l1.email_normalized = l2.email_normalized
  AND l1.id <> l2.id
  AND l1.created_at < l2.created_at;

-- Create Unique Constraint on email_normalized
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_leads_email_normalized'
    ) THEN
        ALTER TABLE leads ADD CONSTRAINT uq_leads_email_normalized UNIQUE (email_normalized);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. HARDEN ENROLLMENTS TABLE
-- Add unique constraint on (user_id, course_id) to prevent multi-enrollment races
-- ------------------------------------------------------------------------------

-- Deduplicate any existing duplicate enrollments for the same user and course
DELETE FROM enrollments e1
USING enrollments e2
WHERE e1.user_id = e2.user_id
  AND e1.course_id = e2.course_id
  AND e1.id <> e2.id
  AND e1.created_at < e2.created_at;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'uq_enrollments_user_course'
    ) THEN
        ALTER TABLE enrollments ADD CONSTRAINT uq_enrollments_user_course UNIQUE (user_id, course_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 3. HARDEN PAYMENTS TABLE
-- Ensure razorpay_order_id index is explicit and unique
-- ------------------------------------------------------------------------------
CREATE UNIQUE INDEX IF NOT EXISTS uq_payments_order_id ON payments (razorpay_order_id);

-- ------------------------------------------------------------------------------
-- 4. ATOMIC PAYMENT COMPLETION & ENROLLMENT RPC
-- Transitions payment atomically and returns whether this caller won the race
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION process_payment_transition(
    p_order_id VARCHAR,
    p_payment_id VARCHAR,
    p_paid_at TIMESTAMPTZ,
    p_course_id VARCHAR
)
RETURNS TABLE (
    success BOOLEAN,
    already_paid BOOLEAN,
    lead_id UUID,
    full_name VARCHAR,
    email_normalized VARCHAR,
    payment_status VARCHAR
) AS $$
DECLARE
    v_payment RECORD;
    v_lead RECORD;
BEGIN
    -- 1. Lock payment row FOR UPDATE
    SELECT * INTO v_payment
    FROM payments
    WHERE razorpay_order_id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN QUERY SELECT FALSE, FALSE, NULL::UUID, NULL::VARCHAR, NULL::VARCHAR, NULL::VARCHAR;
        RETURN;
    END IF;

    -- 2. Fetch associated lead
    SELECT * INTO v_lead
    FROM leads
    WHERE id = v_payment.lead_id
    FOR UPDATE;

    -- 3. Check if already marked as PAID
    IF v_payment.status = 'PAID' THEN
        RETURN QUERY SELECT TRUE, TRUE, v_lead.id, v_lead.full_name, v_lead.email_normalized, 'PAID'::VARCHAR;
        RETURN;
    END IF;

    -- 4. Atomically transition payment to PAID
    UPDATE payments
    SET status = 'PAID',
        razorpay_payment_id = COALESCE(p_payment_id, razorpay_payment_id),
        paid_at = COALESCE(p_paid_at, NOW()),
        updated_at = NOW()
    WHERE id = v_payment.id;

    -- 5. Atomically transition lead to PAID
    UPDATE leads
    SET payment_status = 'PAID',
        updated_at = NOW()
    WHERE id = v_lead.id;

    -- 6. Upsert enrollments record
    INSERT INTO enrollments (payment_id, user_id, email, course_id, status)
    VALUES (COALESCE(p_payment_id, v_payment.razorpay_order_id), v_lead.id, v_lead.email_normalized, p_course_id, 'PAID')
    ON CONFLICT (payment_id) DO NOTHING;

    -- 7. Upsert classroom_enrollments record
    INSERT INTO classroom_enrollments (lead_id, course_id, google_email, status)
    VALUES (v_lead.id, p_course_id, v_lead.email_normalized, 'PENDING')
    ON CONFLICT (lead_id, course_id) DO UPDATE SET updated_at = NOW();

    RETURN QUERY SELECT TRUE, FALSE, v_lead.id, v_lead.full_name, v_lead.email_normalized, 'PAID'::VARCHAR;
    RETURN;
END;
$$ LANGUAGE plpgsql;

-- ------------------------------------------------------------------------------
-- 5. ROW LEVEL SECURITY (RLS) POLICIES
-- Ensure service role / postgres connection has explicit full bypass
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_leads') THEN
        CREATE POLICY service_role_all_leads ON leads FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_payments') THEN
        CREATE POLICY service_role_all_payments ON payments FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_enrollments') THEN
        CREATE POLICY service_role_all_enrollments ON enrollments FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_classroom') THEN
        CREATE POLICY service_role_all_classroom ON classroom_enrollments FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_jobs') THEN
        CREATE POLICY service_role_all_jobs ON enrollment_jobs FOR ALL USING (true) WITH CHECK (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'service_role_all_events') THEN
        CREATE POLICY service_role_all_events ON payment_events FOR ALL USING (true) WITH CHECK (true);
    END IF;
END $$;

-- ==============================================================================
-- ROLLBACK SCRIPT (Down Migration)
-- ==============================================================================
-- DROP FUNCTION IF EXISTS process_payment_transition(VARCHAR, VARCHAR, TIMESTAMPTZ, VARCHAR);
-- ALTER TABLE leads DROP CONSTRAINT IF EXISTS uq_leads_email_normalized;
-- ALTER TABLE enrollments DROP CONSTRAINT IF EXISTS uq_enrollments_user_course;
-- DROP INDEX IF EXISTS uq_payments_order_id;
-- DROP POLICY IF EXISTS service_role_all_leads ON leads;
-- DROP POLICY IF EXISTS service_role_all_payments ON payments;
-- DROP POLICY IF EXISTS service_role_all_enrollments ON enrollments;
-- DROP POLICY IF EXISTS service_role_all_classroom ON classroom_enrollments;
-- DROP POLICY IF EXISTS service_role_all_jobs ON enrollment_jobs;
-- DROP POLICY IF EXISTS service_role_all_events ON payment_events;
