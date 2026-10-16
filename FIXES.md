# Security Audit & Bug Remediation Report (FIXES.md)

**Branch:** `fix/security-audit`  
**Date:** 2026-10-16  
**Status:** All Critical, High, Medium, and Low code issues resolved and verified.

---

## 1. Remediation Status by Finding ID

| Finding ID | Severity | Category | Status | Notes / Rationale |
| :--- | :---: | :---: | :---: | :--- |
| **SEC-01** | Critical | Security | **Fixed** | Removed hardcoded classroom URL and invite code `435t7z2a` from frontend and backend fallback. |
| **SEC-02** | Critical | Security | **Fixed** | Removed `classroomUrl` from unauthenticated status responses in `leadService.ts`. |
| **SEC-03** | High | Security | **Fixed** | Restricted CORS whitelist strictly to trusted domains; removed wildcards and substring matching. |
| **SEC-04** | High | Security | **Fixed** | Enforced Razorpay API payment lookup and verified `status === 'captured'` and order matching. |
| **SEC-05** | High | Security | **Fixed** | Added migration `006_secure_views_and_rls.sql` setting `security_invoker = true` and revoking public grants on `pending_joins`. |
| **SEC-06** | High | Security | **Fixed** | Handled missing payment row in webhook handler with synthetic lead/payment creation to prevent 500 crash loops. |
| **SEC-07** | Medium | Security | **Fixed** | Added explicit `ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;` to migration `006_secure_views_and_rls.sql`. |
| **SEC-08** | Medium | Security | **Verified (No code change needed)** | WaAPI outbound request already bounded by `signal: AbortSignal.timeout(WAAPI_TIMEOUT_MS)` (15s) in `whatsappService.ts`. |
| **SEC-09** | Medium | Security | **Fixed** | Hardcoded server currency to `env.COURSE_CURRENCY || 'INR'`, ignoring untrusted client requests. |
| **SEC-10** | Low | Security | **Fixed** | Applied dedicated rate limiter `jobLimiter` (15 req/15min) to `POST /jobs/retry-invites`. |
| **SEC-11** | Low | Security | **Fixed** | Invalidate/expire previous active unverified tokens before minting a fresh token on WhatsApp retry. |
| **BUG-01** | High | Reliability | **Fixed** | Replaced false success and stale course link (`889084654883`) on polling timeout with error guidance. |
| **BUG-02** | High | Reliability | **Fixed** | Payment verification endpoints now mint a site join token; frontend redirects buyer to `/join/[token]` to enforce phone matching. |
| **BUG-03** | Medium | UX/Reliability | **Fixed** | Prevented countdown timer reset on repeated clicks of "Open Classroom" if already initiated. |
| **BUG-04** | Low | Reliability | **Fixed** | Wrapped `localStorage.getItem` in `try/catch` in `JoinClient.tsx` to handle private browsing exceptions. |
| **SEC-ROTATE** | Critical | Manual Credential | **Needs me** | Reset Google Classroom invite code in Google Classroom web UI (details in Section 5). |

---

## 2. Summary of Changes per Finding

- **SEC-01**: `frontend/components/EnrollmentModal.tsx`, `backend/src/services/joinService.ts`
  - Removed `DEFAULT_GCR_URL` from frontend client bundle and removed hardcoded fallback course ID and invite code `435t7z2a` from backend join service.
- **SEC-02**: `backend/src/services/leadService.ts`, `backend/tests/classroom_and_payment_cases.test.ts`
  - Removed `classroomUrl` from `getEnrollmentStatus` and `getStatusByOrderId` so unauthenticated requests cannot leak the Google Classroom invite link.
- **SEC-03**: `backend/src/app.ts`
  - Replaced `.endsWith('.vercel.app')` and `.includes('superprofit.in')` with an exact origin whitelist (`SITE_URL`, `FRONTEND_URL`, and production domains).
- **SEC-04**: `backend/src/routes/paymentRoutes.ts`
  - In both `/api/verify-payment` and `/api/payment/verify`, added Razorpay API payment retrieval confirming `status === 'captured'` and matching order ID.
- **SEC-05 & SEC-07**: `backend/migrations/006_secure_views_and_rls.sql`
  - Created additive migration to set `security_invoker = true` on `pending_joins`, revoke grants from `anon` and `authenticated`, and enable RLS on `enrollments`.
- **SEC-06**: `backend/src/services/enrollmentWorkflowService.ts`
  - On webhook payment confirmation, if payment record was not previously saved during `/create-order`, dynamically creates lead and payment records to prevent unrecoverable 500 error loops.
- **SEC-09**: `backend/src/routes/paymentRoutes.ts`
  - For `/api/create-order`, enforces server-configured currency (`env.COURSE_CURRENCY || 'INR'`) rather than taking arbitrary currency from client body.
- **SEC-10**: `backend/src/middleware/rateLimiter.ts`, `backend/src/routes/jobRoutes.ts`
  - Created and applied `jobLimiter` (15 requests per 15 minutes) specifically for `POST /jobs/retry-invites`.
- **SEC-11**: `backend/src/services/whatsappService.ts`
  - On retry attempts, expires any active unverified tokens for the order before generating a new token.
- **BUG-01**: `frontend/components/EnrollmentModal.tsx`
  - Replaced polling timeout behavior that assigned a stale course ID (`889084654883`) with a clean `FAILED` state instructing the user to contact support.
- **BUG-02**: `backend/src/routes/paymentRoutes.ts`, `frontend/components/EnrollmentModal.tsx`
  - Mints a join token on verification and returns `joinUrl`; the website modal redirects the user to `/join/[token]` so web buyers also verify their phone number.
- **BUG-03**: `frontend/components/PendingJoinCard.tsx`
  - Only sets the countdown timer if `!hasOpened`, preventing timer resets when students re-click "Open Classroom".
- **BUG-04**: `frontend/app/join/[token]/JoinClient.tsx`
  - Protected `localStorage.getItem` inside `try/catch` to avoid crashes in private/sandboxed browsing environments.
- **Repo Hygiene**: Removed legacy root `server.js` and `schema.sql` files which were out of sync with `backend/`.

---

## 3. Behavior and Response Shape Changes

1. **`GET /api/enrollment/status/:orderId`**:
   - `classroomUrl` has been removed from the returned JSON object. The Google Classroom link is never returned to unauthenticated callers.
2. **`POST /api/verify-payment` & `POST /api/payment/verify`**:
   - Response now returns `{ verified: true, joinUrl: string }`.
   - Frontend redirects the student directly to `joinUrl` (`/join/[token]`) where they enter their name, email, and phone number to obtain the classroom link.
3. **`GET /api/payment/status/:paymentId`**:
   - `classroomUrl` removed from status response to prevent leakage.
4. **CORS Rejection**:
   - Requests from arbitrary `.vercel.app` domains or spoofed subdomains containing `superprofit.in` will now be blocked with a CORS error.

---

## 4. Migrations to Run

Run this SQL file in your **Supabase SQL Editor** (in order):

### Migration 1: `backend/migrations/006_secure_views_and_rls.sql`
- **What it does:**
  - Configures view `pending_joins` to use `security_invoker = true` so RLS on underlying tables is enforced.
  - Revokes `ALL` permissions on view `pending_joins` from `anon` and `authenticated` roles.
  - Grants `SELECT` on `pending_joins` strictly to `service_role`.
  - Executes `ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;` to ensure all tables have RLS enabled.

---

## 5. Manual Steps for You

### 1. Rotate Google Classroom Invite Code (Urgent)
Because invite code `435t7z2a` was committed to earlier git history:
1. Open Google Classroom as teacher/admin.
2. Go to **Settings** (gear icon) -> **General** -> **Invite codes**.
3. Click **Reset** next to Invite code. The old code `435t7z2a` will immediately be deactivated.
4. Copy the new classroom URL (e.g. `https://classroom.google.com/c/ODkxODYwMDQwMzQw?cjc=<NEW_CODE>`).
5. Update `GCR_LINK` in **Render Dashboard** (backend environment variables) and in your local `.env`.

### 2. Git History Cleanup (Optional / Recommended if making repo public)
If this repository will ever be made public:
- The invite code was present in commits `cb11fa2` and `8dc0435`.
- Do **not** force-push until you coordinate with collaborators. If needed, use:
  ```bash
  # Using git-filter-repo (recommended tool by GitHub):
  pip install git-filter-repo
  git filter-repo --replace-text <(echo "435t7z2a==>REDACTED_CODE")
  ```
- If keeping the repository strictly **Private**, rotating the invite code in Google Classroom is sufficient.

### 3. GitHub Repository Settings
1. Go to repository **Settings** -> **Code security and analysis**.
2. Enable **Secret scanning**.
3. Enable **Push protection for secrets**.

### 4. Supabase & Environment Variables
- In Render Dashboard:
  - Verify `SITE_URL` and `FRONTEND_URL` are set to `https://superprofit.in` (or your exact production frontend URL).
  - Verify `COURSE_CURRENCY` is `INR`.
  - Verify `GCR_LINK` points to your newly rotated Google Classroom URL.
- In Vercel Dashboard:
  - Verify `NEXT_PUBLIC_BACKEND_URL` points to your backend Render URL.
  - Verify `NEXT_PUBLIC_RAZORPAY_KEY_ID` is set to your live/test key ID.

---

## 6. Test by Hand in Razorpay Test Mode Checklist

- [ ] **1. Create Order & Pay**:
  - Open website frontend, enter Name, Phone, and Email in Enrollment Modal.
  - Complete payment in Razorpay modal with test card / UPI.
- [ ] **2. Redirect to Join Page**:
  - Verify the website automatically redirects to `/join/[token]`.
- [ ] **3. Test Wrong Phone**:
  - Enter name, email, and an incorrect phone number.
  - Verify error message "Details don't match. Please check your information and try again."
  - Verify no Classroom link or sensitive data is leaked in the network tab.
- [ ] **4. Test Right Phone**:
  - Enter the exact 10-digit phone number entered during checkout.
  - Verify Google Classroom link is revealed.
- [ ] **5. Sticky Banner & Countdown**:
  - Verify the reminder banner displays: "Please join the Classroom to complete your enrollment".
  - Click "Open Classroom"; verify tab opens and countdown runs for 15 seconds.
  - Re-click "Open Classroom"; verify countdown timer does not reset.
  - Confirm enrollment after countdown finishes; verify status changes to confirmed.
- [ ] **6. Webhook Idempotency**:
  - Trigger a test `order.paid` webhook twice from Razorpay Dashboard.
  - Verify second webhook is logged as duplicate and does not duplicate leads or send duplicate WhatsApp messages.
- [ ] **7. Retry Job**:
  - Send POST request to `/jobs/retry-invites` with header `x-job-secret`.
  - Verify 200 OK response with `{ status: "ok", retried: 0 }`.
  - Verify missing/wrong secret returns 401 Unauthorized.
