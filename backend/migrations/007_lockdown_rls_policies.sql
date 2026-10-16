-- ==============================================================================
-- Migration: 007_lockdown_rls_policies.sql
-- Description: Drop open PUBLIC RLS policies and restrict strictly to service_role (SEC-CRIT-01)
-- Target: Supabase / PostgreSQL 14+
-- Safe to re-run. Additive only.
-- ==============================================================================

-- Drop open public policies and recreate strictly TO service_role
DO $$
BEGIN
    -- 1. leads
    DROP POLICY IF EXISTS service_role_all_leads ON leads;
    CREATE POLICY service_role_all_leads ON leads TO service_role FOR ALL USING (true) WITH CHECK (true);

    -- 2. payments
    DROP POLICY IF EXISTS service_role_all_payments ON payments;
    CREATE POLICY service_role_all_payments ON payments TO service_role FOR ALL USING (true) WITH CHECK (true);

    -- 3. enrollments
    DROP POLICY IF EXISTS service_role_all_enrollments ON enrollments;
    CREATE POLICY service_role_all_enrollments ON enrollments TO service_role FOR ALL USING (true) WITH CHECK (true);

    -- 4. classroom_enrollments
    DROP POLICY IF EXISTS service_role_all_classroom ON classroom_enrollments;
    CREATE POLICY service_role_all_classroom ON classroom_enrollments TO service_role FOR ALL USING (true) WITH CHECK (true);

    -- 5. enrollment_jobs
    DROP POLICY IF EXISTS service_role_all_jobs ON enrollment_jobs;
    CREATE POLICY service_role_all_jobs ON enrollment_jobs TO service_role FOR ALL USING (true) WITH CHECK (true);

    -- 6. payment_events
    DROP POLICY IF EXISTS service_role_all_events ON payment_events;
    CREATE POLICY service_role_all_events ON payment_events TO service_role FOR ALL USING (true) WITH CHECK (true);

    -- 7. outbox_jobs
    DROP POLICY IF EXISTS service_role_all_outbox ON outbox_jobs;
    CREATE POLICY service_role_all_outbox ON outbox_jobs TO service_role FOR ALL USING (true) WITH CHECK (true);
END $$;
