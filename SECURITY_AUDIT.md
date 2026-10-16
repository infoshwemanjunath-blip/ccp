# Pre-Push Security & Reliability Audit Report

**Date:** 2026-10-16  
**Auditor:** Pre-Push Automated Security & Bug Audit  
**Recommendation:** **DO NOT PUSH** (Action Required: Rotate Committed Classroom Invite Code & Fix Critical RLS Policies Before Push)

---

## 1. Summary

| Severity | Security Findings | Bugs | Total |
| :--- | :---: | :---: | :---: |
| **Critical** | 2 | 1 | **3** |
| **High** | 3 | 2 | **5** |
| **Medium** | 2 | 1 | **3** |
| **Low** | 1 | 1 | **2** |
| **Total** | **8** | **5** | **13** |

### Verdict: DO NOT PUSH
Pushing to GitHub in the current state poses two critical security hazards:
1. **Live Google Classroom Invite Code Committed in Git History**: The active invite code `435t7z2a` and course ID `ODkxODYwMDQwMzQw` (`891860040340`) were committed in git history (commits `ce9ff91` and `8dc0435`). Anyone viewing the repository history can join Google Classroom without paying.
2. **Supabase RLS Policies Grant Public Access (`PUBLIC`)**: In migrations `002_concurrency_hardening.sql` and `003_outbox_table.sql`, `CREATE POLICY` statements omitted `TO service_role`. In PostgreSQL, omitting the role targets `PUBLIC` by default, exposing `leads`, `payments`, `outbox_jobs`, and `enrollments` tables directly to PostgREST clients via the Supabase anonymous key.

---

## 2. Rotate These Before Anything Else

The following credentials and access keys were committed in git history or hardcoded in working tree files. Rotating and invalidating them is mandatory prior to pushing code to GitHub:

| Secret / Asset | Location & Commit | First 4 Chars | Action Required |
| :--- | :--- | :--- | :--- |
| **Google Classroom Invite Code** | `frontend/components/EnrollmentModal.tsx:59`<br>`frontend/components/RazorpayCheckoutButton.tsx:163`<br>`backend/src/services/joinService.ts:71`<br>Commits: `ce9ff91`, `8dc0435` | `435t...` (`435t7z2a`) | **Reset immediately in Google Classroom**: Go to Classroom -> Settings -> General -> Invite codes -> Click "Reset". The old link stops accepting new students. Update `GCR_LINK` and `GOOGLE_CLASSROOM_ENROLLMENT_CODE` in Render backend environment variables. |
| **Google Classroom Hardcoded Fallback** | `backend/src/services/emailService.ts:40`<br>Commits: `c07f04d`, `8dc0435`, `ac222ff` | `u5d3...` (`u5d3zmob`) | **Reset in Google Classroom if active**: Remove fallback default string from `emailService.ts:40` so missing env vars fail closed. |
| **Razorpay Test Key ID (Committed)** | `frontend/components/EnrollmentModal.tsx`<br>`frontend/components/RazorpayCheckoutButton.tsx`<br>Commits: `cc6c587`, `ce9ff91` | `rzp_...` (`rzp_test_TkW6...`) | Regenerate Razorpay Test Key if test environment contains sensitive test customer data. |

*(Note: Working tree `.env` and `backend/.env` live secrets—Razorpay Key Secret `kO53...`, Webhook Secret `kO53...`, Supabase Service Role Key `sb_s...`, Google OAuth Refresh Token `1//0...`, and SMTP password `Shwe...`—were verified and confirmed **NOT** committed in git history).*

---

## 3. Security Findings

### Critical Severity

#### [SEC-CRIT-01] Supabase RLS Policies Grant Full Unrestricted Access to Public Anonymous Role
- **File & Line:** [`backend/migrations/002_concurrency_hardening.sql:138-156`](file:///d:/CCP/backend/migrations/002_concurrency_hardening.sql#L138-L156), [`backend/migrations/003_outbox_table.sql:33-35`](file:///d:/CCP/backend/migrations/003_outbox_table.sql#L33-L35)
- **What is wrong:** `CREATE POLICY service_role_all_leads ON leads FOR ALL USING (true) WITH CHECK (true);` and identical policies for `payments`, `enrollments`, `classroom_enrollments`, `enrollment_jobs`, `payment_events`, and `outbox_jobs` omit `TO service_role`. In PostgreSQL/Supabase, omitting `TO <role>` defaults to `TO PUBLIC`.
- **Exploitation:** Any client holding the Supabase public anonymous key (`anon`) can query PostgREST (`https://<project>.supabase.co/rest/v1/leads` or `payments`) to dump customer names, unmasked phone numbers, emails, and payment records, or tamper with rows directly.
- **Suggested Fix:**
  ```sql
  -- Drop open public policies and restrict strictly to service_role:
  DROP POLICY IF EXISTS service_role_all_leads ON leads;
  CREATE POLICY service_role_all_leads ON leads TO service_role FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS service_role_all_payments ON payments;
  CREATE POLICY service_role_all_payments ON payments TO service_role FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS service_role_all_enrollments ON enrollments;
  CREATE POLICY service_role_all_enrollments ON enrollments TO service_role FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS service_role_all_classroom ON classroom_enrollments;
  CREATE POLICY service_role_all_classroom ON classroom_enrollments TO service_role FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS service_role_all_jobs ON enrollment_jobs;
  CREATE POLICY service_role_all_jobs ON enrollment_jobs TO service_role FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS service_role_all_events ON payment_events;
  CREATE POLICY service_role_all_events ON payment_events TO service_role FOR ALL USING (true) WITH CHECK (true);

  DROP POLICY IF EXISTS service_role_all_outbox ON outbox_jobs;
  CREATE POLICY service_role_all_outbox ON outbox_jobs TO service_role FOR ALL USING (true) WITH CHECK (true);
  ```
- **Confidence:** High

#### [SEC-CRIT-02] Live Google Classroom Join Link Committed in Git History
- **File & Line:** [`frontend/components/EnrollmentModal.tsx:59`](file:///d:/CCP/frontend/components/EnrollmentModal.tsx#L59), [`backend/src/services/joinService.ts:71`](file:///d:/CCP/backend/src/services/joinService.ts#L71) (Commits: `ce9ff91`, `8dc0435`)
- **What is wrong:** The live Google Classroom join URL (`https://classroom.google.com/c/ODkxODYwMDQwMzQw?cjc=435t7z2a`) was committed to git history across multiple commits before removal in `adb2a10`.
- **Exploitation:** Anyone with read access to the GitHub repository can run `git log -S "435t7z2a"` to extract the invite code and join the Google Classroom course without paying.
- **Suggested Fix:** Reset the invite code in Google Classroom settings. Ensure GitHub repo is set to Private.
- **Confidence:** High

---

### High Severity

#### [SEC-HIGH-01] Hardcoded Google Classroom Invite Code Fallback in Email Service
- **File & Line:** [`backend/src/services/emailService.ts:40-41`](file:///d:/CCP/backend/src/services/emailService.ts#L40-L41)
- **What is wrong:** `const code = env.GOOGLE_CLASSROOM_ENROLLMENT_CODE || 'u5d3zmob';` hardcodes an invite code fallback directly in server source code.
- **Exploitation:** If deployed without setting `GOOGLE_CLASSROOM_ENROLLMENT_CODE`, students receive an email with direct access code `u5d3zmob`. Anyone inspecting the repository can use this code to join.
- **Suggested Fix:**
  ```ts
  const code = env.GOOGLE_CLASSROOM_ENROLLMENT_CODE;
  if (!code) {
    logger.warn('GOOGLE_CLASSROOM_ENROLLMENT_CODE not configured');
  }
  ```
- **Confidence:** High

#### [SEC-HIGH-02] Unauthenticated Status Endpoint Discloses Unmasked Customer Email (IDOR)
- **File & Line:** [`backend/src/services/leadService.ts:101-103`](file:///d:/CCP/backend/src/services/leadService.ts#L101-L103), [`backend/src/routes/enrollmentRoutes.ts:98-131`](file:///d:/CCP/backend/src/routes/enrollmentRoutes.ts#L98-L131)
- **What is wrong:** `GET /api/enrollment/status/:orderId` requires no authentication or session token and returns `email: row.email_normalized` and `message: 'Invitation sent to ' + row.email_normalized` in plaintext.
- **Exploitation:** An attacker discovering or scanning Razorpay order IDs can harvest customer email addresses.
- **Suggested Fix:**
  ```ts
  // Return masked email instead of raw email:
  import { maskEmail } from '../utils/logger.js';
  return {
    status: 'INVITED',
    message: `Invitation sent to your Google account. Open Classroom and click Accept.`,
    email: maskEmail(row.email_normalized),
    orderId,
  };
  ```
- **Confidence:** High

#### [SEC-HIGH-03] Plaintext GCR Link Logged to Standard Output in Simulated Email Mode
- **File & Line:** [`backend/src/services/emailService.ts:47-50`](file:///d:/CCP/backend/src/services/emailService.ts#L47-L50)
- **What is wrong:** `logger.info('SMTP not configured - simulated email dispatch', { email: toEmail, directUrl: directClassroomUrl });` logs `directUrl` (which contains `env.GCR_LINK`) to standard output.
- **Exploitation:** Server logs captured by cloud log aggregators or viewable in monitoring consoles expose the Google Classroom join link.
- **Suggested Fix:**
  ```ts
  logger.info('SMTP not configured - simulated email dispatch', {
    email: toEmail,
  });
  ```
- **Confidence:** High

---

### Medium Severity

#### [SEC-MED-01] HTML / Script Injection via Unvalidated Name in Standard Create-Order Email
- **File & Line:** [`backend/src/routes/paymentRoutes.ts:26-62`](file:///d:/CCP/backend/src/routes/paymentRoutes.ts#L26-L62), [`backend/src/services/emailService.ts:87`](file:///d:/CCP/backend/src/services/emailService.ts#L87)
- **What is wrong:** Unlike `enrollmentRoutes.ts` which validates with Zod `createOrderSchema`, `paymentRoutes.post('/create-order')` accepts unvalidated `notes?.name` or `req.body?.name`. In `emailService.ts:87`, `Welcome, ${recipientName}!` interpolates the name raw into HTML email output without HTML escaping.
- **Exploitation:** Attacker submitting HTML tags or script injection in `name` to `/api/create-order` injects arbitrary markup or phishing elements into confirmation emails.
- **Suggested Fix:** Validate `req.body` using `createOrderSchema` in `paymentRoutes.ts` and sanitize/escape `recipientName` in `emailService.ts`.
- **Confidence:** High

#### [SEC-MED-02] Plaintext Insecure HTTP Origins in Backend CORS Whitelist
- **File & Line:** [`backend/src/app.ts:31-32`](file:///d:/CCP/backend/src/app.ts#L31-L32)
- **What is wrong:** `allowedOrigins` includes plain unencrypted HTTP origins `'http://superprofit.in'` and `'http://www.superprofit.in'`.
- **Exploitation:** An on-path network attacker on an unencrypted network can interact with CORS-protected endpoints.
- **Suggested Fix:** Remove `http://` production origins from `allowedOrigins` in `app.ts`. Keep only `https://`.
- **Confidence:** High

---

### Low Severity

#### [SEC-LOW-01] Missing Socket Timeout on Outbound Razorpay SDK Client
- **File & Line:** [`backend/src/services/razorpayService.ts:14-19`](file:///d:/CCP/backend/src/services/razorpayService.ts#L14-L19)
- **What is wrong:** The Razorpay SDK instance is created without an explicit request timeout parameter.
- **Exploitation:** In the event of network degradation between Render and Razorpay, HTTP connections can hang until socket keepalive exhaustion.
- **Suggested Fix:** Pass timeout options or configure `http.Agent` timeout.
- **Confidence:** Medium

---

## 4. Bugs (Logic & Reliability)

### Critical Severity

#### [BUG-CRIT-01] Fatal UUID Type Cast Error Swallows Welcome Email Outbox Enqueueing
- **File & Line:** [`backend/src/services/enrollmentWorkflowService.ts:326-338`](file:///d:/CCP/backend/src/services/enrollmentWorkflowService.ts#L326-L338)
- **What is wrong:**
  ```ts
  INSERT INTO outbox_jobs (payment_id, job_type, payload, status)
  VALUES (
    (SELECT payment_id FROM enrollments WHERE user_id = $1 AND course_id = $2 LIMIT 1)::uuid,
    'WELCOME_EMAIL', $3, 'PENDING'
  )
  ```
  `enrollments.payment_id` stores `razorpay_payment_id` (a string such as `'pay_Q1w2e3r4'`), NOT a database UUID. Casting `'pay_Q1w2e3r4'::uuid` throws a fatal PostgreSQL error: `invalid input syntax for type uuid: "pay_Q1w2e3r4"`.
- **Effect:** The error is caught by `catch (err) { logger.warn(...) }`. As a result, the `WELCOME_EMAIL` outbox job is NEVER inserted. No welcome emails are ever sent out.
- **Trigger:** Any successful student Google Classroom enrollment.
- **Suggested Fix:**
  ```ts
  await query(
    `INSERT INTO outbox_jobs (payment_id, job_type, payload, status)
     VALUES (
       (SELECT id FROM payments WHERE lead_id = $1 ORDER BY created_at DESC LIMIT 1),
       'WELCOME_EMAIL', $2, 'PENDING'
     ) ON CONFLICT DO NOTHING`,
    [leadId, JSON.stringify({ toEmail: email, fullName, courseId })]
  );
  ```
- **Confidence:** High

---

### High Severity

#### [BUG-HIGH-01] Missing Customer Phone in Payment Auto-Recovery Permanently Locks Out Buyer
- **File & Line:** [`backend/src/services/enrollmentWorkflowService.ts:43-57`](file:///d:/CCP/backend/src/services/enrollmentWorkflowService.ts#L43-L57), [`backend/src/services/webhookService.ts:93-125`](file:///d:/CCP/backend/src/services/webhookService.ts#L93-L125)
- **What is wrong:** When a webhook arrives before the order row exists (e.g. database latency during `create-order`), `handlePaymentSuccess` auto-recovers by creating a synthetic lead and payment row. However, `newLeadRes` sets `phone = ''`, and `newPaymentRes` leaves `customer_phone` NULL. Webhook handler never extracts or passes phone from `eventPayload.payload.payment.entity.contact`.
- **Effect:** When the paid buyer visits `/join/[token]` and enters their mobile number, `paidPhone` is null. `joinService.verify()` permanently reports mismatch until the order is locked out. WhatsApp invite also crashes immediately with "Invalid or missing phone number".
- **Trigger:** Webhook processes payment before `create-order` finishes inserting into DB.
- **Suggested Fix:** Extract `customerPhone = paymentEntity?.contact || orderEntity?.notes?.phone` in `webhookService.ts` and pass to `handlePaymentSuccess` to populate `customer_phone`.
- **Confidence:** High

#### [BUG-HIGH-02] PaymentRoutes `/create-order` Fails to Persist `customer_phone` on Order Row
- **File & Line:** [`backend/src/routes/paymentRoutes.ts:50-55`](file:///d:/CCP/backend/src/routes/paymentRoutes.ts#L50-L55)
- **What is wrong:** `paymentRoutes.post('/create-order')` executes:
  `INSERT INTO payments (lead_id, razorpay_order_id, amount, currency, status) VALUES ($1, $2, $3, $4, 'PENDING')`
  It completely omits `customer_phone`.
- **Effect:** If a customer checks out via this route (used by `RazorpayCheckoutButton.tsx` and as fallback in `EnrollmentModal.tsx`), `payments.customer_phone` is NULL. Verification must fall back to `leads.phone`. If the lead was already registered with an older phone number, the phone will mismatch.
- **Trigger:** Orders created through `/api/create-order` or `/api/payment/create-order`.
- **Suggested Fix:** Include `customer_phone` column and pass `toIndianMobile91(req.body.phone || notes?.phone)`.
- **Confidence:** High

---

### Medium Severity

#### [BUG-MED-01] Modal Fails User UI on Transient 502 Gateway Error Instead of Polling
- **File & Line:** [`frontend/components/EnrollmentModal.tsx:487-514`](file:///d:/CCP/frontend/components/EnrollmentModal.tsx#L487-L514)
- **What is wrong:** In `EnrollmentModal.tsx`, if `/api/verify-payment` returns HTTP 502 (caused when Razorpay API payment lookup times out in `paymentRoutes.ts:148`), `verifyRes.ok` is false. The code jumps to `else { setModalState("FAILED"); }` instead of catching and invoking `pollEnrollmentStatus(orderData.orderId)`.
- **Effect:** User sees a red "Payment Failed / Signature verification failed" error in their modal even though money was deducted and the payment will succeed via webhook.
- **Trigger:** Transient timeout connecting to Razorpay API during fast-path verification.
- **Suggested Fix:**
  ```tsx
  if (verifyRes.status >= 500) {
    pollEnrollmentStatus(orderData.orderId);
    return;
  }
  ```
- **Confidence:** High

---

### Low Severity

#### [BUG-LOW-01] Daily Reconciliation Job `DO NOTHING` Fails to Re-trigger Failed Outbox Jobs
- **File & Line:** [`backend/scripts/reconciliationJob.ts:27`](file:///d:/CCP/backend/scripts/reconciliationJob.ts#L27)
- **What is wrong:** `INSERT INTO outbox_jobs ... ON CONFLICT (payment_id, job_type) DO NOTHING`.
- **Effect:** If an outbox job previously failed (`status = 'FAILED'`), running `reconciliationJob.ts` does nothing and leaves the job failed forever.
- **Trigger:** Running `reconciliationJob.ts` on payments with failed outbox jobs.
- **Suggested Fix:** Change to `ON CONFLICT (payment_id, job_type) DO UPDATE SET status = 'PENDING', attempts = 0, next_run_at = NOW()`.
- **Confidence:** High

---

## 5. Checked and Fine

The following core components, security controls, and flows were audited and verified to be properly implemented:

- **Payment Signature Verification:** Both `/verify-payment` and `/webhooks/razorpay` use `crypto.timingSafeEqual` over HMAC SHA-256 signatures. The raw body parser is applied specifically to webhook routes before JSON parsing.
- **Server Price Enforcement:** Course price is strictly hardcoded from server environment `COURSE_PRICE_PAISE` (349900 paise = ₹3499) and currency `COURSE_CURRENCY` ('INR'). Webhooks verify amount matches `COURSE_PRICE_PAISE`.
- **Webhook Idempotency:** The `payment_events` table enforces unique `event_id` constraints, ensuring duplicate webhook deliveries are safely identified and skipped.
- **Token Security:** Join tokens and session tokens are 32 cryptographically random bytes generated via `crypto.randomBytes(32).toString('base64url')`. Only SHA-256 hashes are stored in the database.
- **Atomic Verification Locks:** Phone verification uses PostgreSQL transaction locking (`FOR UPDATE OF p` on the payment row) to prevent race conditions across parallel requests attempting to bypass reveal limits or failed attempt counters.
- **Client Storage Privacy:** Frontend `localStorage` only stores the opaque session token (`joinSession`), never the Google Classroom URL. All `localStorage` accesses are wrapped in `try/catch` to prevent private browsing crashes.
- **Crawler & Referrer Protection:** Join routes `/join/[token]` and `/join/continue` explicitly set `robots: { index: false, follow: false }` and `referrer: "no-referrer"`.
- **Proxy Configuration:** `app.set('trust proxy', 1)` is enabled in `app.ts`, ensuring rate limiters evaluate real client IPs behind Render's reverse proxy.
- **External Links:** All target `_blank` anchor tags include `rel="noopener noreferrer"`.
- **Build & Test Quality:** Full test suites pass cleanly (57 backend tests, 7 frontend tests), TypeScript checks pass without errors, and Next.js production builds complete successfully.

---

## 6. Pre-Push Checklist

Before pushing this repository to GitHub, execute the following steps in order:

### 1. Rotate Credentials in Google Classroom
- [ ] Open Google Classroom -> Settings -> General -> Invite codes -> Click **Reset**.
- [ ] Copy the new Classroom invite code and update `GCR_LINK` and `GOOGLE_CLASSROOM_ENROLLMENT_CODE` in Render backend environment variables.

### 2. Apply Database Migration for RLS Lockdown
Run the following SQL in Supabase SQL Editor to revoke open public policies:
```sql
DROP POLICY IF EXISTS service_role_all_leads ON leads;
CREATE POLICY service_role_all_leads ON leads TO service_role FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_payments ON payments;
CREATE POLICY service_role_all_payments ON payments TO service_role FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_enrollments ON enrollments;
CREATE POLICY service_role_all_enrollments ON enrollments TO service_role FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_classroom ON classroom_enrollments;
CREATE POLICY service_role_all_classroom ON classroom_enrollments TO service_role FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_jobs ON enrollment_jobs;
CREATE POLICY service_role_all_jobs ON enrollment_jobs TO service_role FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_events ON payment_events;
CREATE POLICY service_role_all_events ON payment_events TO service_role FOR ALL USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS service_role_all_outbox ON outbox_jobs;
CREATE POLICY service_role_all_outbox ON outbox_jobs TO service_role FOR ALL USING (true) WITH CHECK (true);
```

### 3. Repository Configuration on GitHub
- [ ] Ensure repository visibility is set to **Private**.
- [ ] On GitHub, navigate to **Settings -> Code security and analysis**:
  - Enable **Secret scanning**.
  - Enable **Push protection** (blocks accidental commits containing API keys).

### 4. Setup External Cron for WhatsApp Retry Job
- [ ] In Render (or external cron provider), create a Cron Job calling:
  ```bash
  curl -X POST https://your-backend.onrender.com/api/jobs/retry-invites \
    -H "x-job-secret: YOUR_JOB_SECRET"
  ```
  Schedule: Every 5 or 10 minutes.

### 5. Final Local Verification Commands
```powershell
# 1. Verify clean git working tree
git status

# 2. Run backend test suite
cd d:\CCP\backend
npm test
npm run build

# 3. Run frontend test suite
cd d:\CCP\frontend
npm test
npm run build
```
