-- ==============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Core Schema for Super Profit Enrollment & Payment System
-- Target: Supabase / PostgreSQL 14+
-- ==============================================================================

-- Enable UUID extension if not already enabled
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------------------------
-- 1. LEADS TABLE
-- Stores pre-checkout and checkout user identity before payment
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS leads (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    full_name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL,
    email VARCHAR(255) NOT NULL,
    email_normalized VARCHAR(255) NOT NULL,
    payment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (payment_status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    enrollment_status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (enrollment_status IN ('PENDING', 'ENROLLED', 'FAILED', 'REMOVAL_PENDING', 'REMOVED')),
    razorpay_customer_id VARCHAR(100),
    latest_order_id VARCHAR(100),
    google_classroom_course_id VARCHAR(100),
    google_classroom_user_id VARCHAR(255),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_leads_email_normalized ON leads(email_normalized);
CREATE INDEX IF NOT EXISTS idx_leads_latest_order_id ON leads(latest_order_id);
CREATE INDEX IF NOT EXISTS idx_leads_payment_status ON leads(payment_status);

-- ------------------------------------------------------------------------------
-- 2. PAYMENTS TABLE
-- Authoritative record of payment orders and transactions
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    razorpay_order_id VARCHAR(100) NOT NULL UNIQUE,
    razorpay_payment_id VARCHAR(100) UNIQUE,
    amount INTEGER NOT NULL CHECK (amount > 0), -- Amount in paise
    currency VARCHAR(10) NOT NULL DEFAULT 'INR',
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PAID', 'FAILED', 'REFUNDED')),
    signature VARCHAR(255),
    paid_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payments_order_id ON payments(razorpay_order_id);
CREATE INDEX IF NOT EXISTS idx_payments_payment_id ON payments(razorpay_payment_id);
CREATE INDEX IF NOT EXISTS idx_payments_lead_id ON payments(lead_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ------------------------------------------------------------------------------
-- 3. PAYMENT_EVENTS TABLE (Webhook Idempotency)
-- Ensures duplicate webhooks from Razorpay are processed exactly once
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id VARCHAR(255) NOT NULL UNIQUE,
    event_type VARCHAR(100) NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    processed BOOLEAN NOT NULL DEFAULT FALSE,
    processed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_payment_events_event_id ON payment_events(event_id);
CREATE INDEX IF NOT EXISTS idx_payment_events_processed ON payment_events(processed);

-- ------------------------------------------------------------------------------
-- 4. CLASSROOM_ENROLLMENTS TABLE
-- Tracks Google Classroom state per paid lead
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS classroom_enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
    course_id VARCHAR(100) NOT NULL,
    google_email VARCHAR(255) NOT NULL,
    google_user_id VARCHAR(255),
    invitation_id VARCHAR(255),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'ENROLLED', 'FAILED', 'REMOVAL_PENDING', 'REMOVED')),
    attempt_count INTEGER NOT NULL DEFAULT 0,
    last_error_code VARCHAR(100),
    last_error_message TEXT,
    enrolled_at TIMESTAMPTZ,
    removed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uq_lead_course UNIQUE (lead_id, course_id)
);

CREATE INDEX IF NOT EXISTS idx_enrollments_lead_id ON classroom_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_status ON classroom_enrollments(status);
CREATE INDEX IF NOT EXISTS idx_enrollments_google_email ON classroom_enrollments(google_email);

-- ------------------------------------------------------------------------------
-- 5. ENROLLMENT_ATTEMPTS TABLE
-- Diagnostic audit log of every external Google Classroom API interaction
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollment_attempts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES classroom_enrollments(id) ON DELETE CASCADE,
    attempt_number INTEGER NOT NULL,
    status VARCHAR(50) NOT NULL,
    error_code VARCHAR(100),
    error_message TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_attempts_enrollment_id ON enrollment_attempts(enrollment_id);

-- ------------------------------------------------------------------------------
-- 6. ENROLLMENT_JOBS TABLE
-- Database-backed persistent retry queue for transient Google Classroom errors
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollment_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    enrollment_id UUID NOT NULL REFERENCES classroom_enrollments(id) ON DELETE CASCADE,
    action VARCHAR(50) NOT NULL CHECK (action IN ('ENROLL', 'REMOVE')),
    status VARCHAR(50) NOT NULL DEFAULT 'PENDING'
        CHECK (status IN ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED')),
    next_run_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    attempts INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 5,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_jobs_status_next_run ON enrollment_jobs(status, next_run_at);

-- ------------------------------------------------------------------------------
-- 7. ENROLLMENTS TABLE (Authoritative payment-to-classroom mapping)
-- Tracks student enrollment by payment_id with status PAID, INVITED, ENROLLED, FAILED
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS enrollments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    payment_id VARCHAR(100) NOT NULL UNIQUE,
    user_id UUID REFERENCES leads(id) ON DELETE SET NULL,
    email VARCHAR(255) NOT NULL,
    course_id VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL DEFAULT 'PAID'
        CHECK (status IN ('PAID', 'INVITED', 'ENROLLED', 'FAILED')),
    attempts INTEGER NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_enrollments_payment_id ON enrollments(payment_id);
CREATE INDEX IF NOT EXISTS idx_enrollments_email ON enrollments(email);
CREATE INDEX IF NOT EXISTS idx_enrollments_general_status ON enrollments(status);


-- ------------------------------------------------------------------------------
-- Auto-update timestamps trigger function
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION update_timestamp_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE TRIGGER trg_leads_updated_at
BEFORE UPDATE ON leads
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE OR REPLACE TRIGGER trg_payments_updated_at
BEFORE UPDATE ON payments
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE OR REPLACE TRIGGER trg_enrollments_updated_at
BEFORE UPDATE ON classroom_enrollments
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

CREATE OR REPLACE TRIGGER trg_jobs_updated_at
BEFORE UPDATE ON enrollment_jobs
FOR EACH ROW EXECUTE FUNCTION update_timestamp_column();

-- ------------------------------------------------------------------------------
-- ROW LEVEL SECURITY (RLS)
-- Lock down tables from public client access. Only backend server role can query.
-- ------------------------------------------------------------------------------
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE payment_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE classroom_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE enrollment_jobs ENABLE ROW LEVEL SECURITY;
