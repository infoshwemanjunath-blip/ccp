-- ==============================================================================
-- Migration: 006_secure_views_and_rls.sql
-- Description: Harden view permissions (security_invoker) and enforce RLS on enrollments
-- Target: Supabase / PostgreSQL 14+
-- Safe to re-run. Additive only.
-- ==============================================================================

-- 1. Enforce RLS on enrollments table (SEC-07)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'enrollments') THEN
        ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;
    END IF;
END $$;

-- 2. Lock down pending_joins view from public / anonymous PostgREST access (SEC-05)
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.views WHERE table_schema = 'public' AND table_name = 'pending_joins') THEN
        -- Run view with invoker's rights to respect RLS
        ALTER VIEW pending_joins SET (security_invoker = true);
        
        -- Revoke public API read grants from anonymous and authenticated roles
        REVOKE ALL ON pending_joins FROM anon, authenticated;
        
        -- Grant access strictly to the backend service role
        GRANT SELECT ON pending_joins TO service_role;
    END IF;
END $$;
