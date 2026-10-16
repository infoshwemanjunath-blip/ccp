# Pre-Push Security & Reliability Audit Report

**Date:** 2026-10-16  
**Auditor:** Automated Pre-Push Review  
**Recommendation:** **DO NOT PUSH** (Action Required: 3 Critical Issues Must Be Resolved Before Public Push)

---

## 1. Executive Summary

| Severity | Security Findings | Bugs | Total |
| :--- | :---: | :---: | :---: |
| **Critical** | 2 | 0 | **2** |
| **High** | 4 | 2 | **6** |
| **Medium** | 3 | 1 | **4** |
| **Low** | 2 | 1 | **3** |
| **Total** | **11** | **4** | **15** |

### Verdict: DO NOT PUSH
The repository contains critical vulnerabilities that allow **anyone to obtain the Google Classroom join link without paying**:
1. The live Google Classroom join URL with invite code (`cjc=435t7z2a`) is hardcoded in frontend component `EnrollmentModal.tsx` and compiled into client-side JavaScript bundles.
2. The public endpoint `GET /api/enrollment/status/:orderId` returns `classroomUrl` (`GCR_LINK`) for any paid order without authentication, token, or phone number matching.
3. The live classroom link was committed to git history in commits `cb11fa2` and `8dc0435`. The invite code must be rotated in Google Classroom before pushing.

---

## 2. Rotate These Before Anything Else

The following secret/access credential was committed to git history and exposed in frontend code:

| Secret / Asset | Committed Location | First 4 Chars | Action Required |
| :--- | :--- | :--- | :--- |
| **Google Classroom Invite Code** | `frontend/components/EnrollmentModal.tsx:59`<br>`backend/src/services/joinService.ts:71`<br>Commits: `cb11fa2`, `8dc0435` | `435t...` (`435t7z2a`) | **Reset immediately in Google Classroom**: Go to Classroom Settings -> General -> Invite codes -> Click "Reset". The old link will immediately stop accepting new students. Update `GCR_LINK` in backend Render environment variables. |

*(Note: Live Razorpay Key Secret `kO53...`, Supabase Service Role Key `sb_s...`, Google OAuth Refresh Token `1//0...`, and SMTP password were confirmed **NOT** committed in git history).*

---

## 3. Security Findings

### Critical Severity

#### [SEC-01] Live Google Classroom Invite Code Hardcoded in Frontend Bundle
- **File & Line:** `frontend/components/EnrollmentModal.tsx:59`, `frontend/components/EnrollmentModal.tsx:849`
- **What is wrong:** `const DEFAULT_GCR_URL = "https://classroom.google.com/c/ODkxODYwMDQwMzQw?cjc=435t7z2a";` is defined directly in a client React component (`"use client"`).
- **Exploitation:** Any visitor can open browser DevTools, inspect the client bundle or page source, and copy the Google Classroom join link (`cjc=435t7z2a`) to join the course completely free without paying.
- **Suggested Fix:** Remove `DEFAULT_GCR_URL` from frontend code entirely. The frontend must only obtain classroom access via a verified backend join flow, never falling back to a static URL.
- **Confidence:** High

#### [SEC-02] Unauthenticated Order Status Endpoint Returns GCR Link Without Phone Match
- **File & Line:** `backend/src/services/leadService.ts:96-134`, `backend/src/routes/enrollmentRoutes.ts:98-100`
- **What is wrong:** `GET /api/enrollment/status/:orderId` takes an unauthenticated Razorpay `orderId` in the URL. If the order is `PAID`, `leadService.getEnrollmentStatus` includes `classroomUrl: directClassroomUrl` (`env.GCR_LINK`) directly in the JSON response.
- **Exploitation:** Anyone who discovers or guesses a Razorpay order ID (e.g., from browser network logs, shared receipts, or sequential generation) can query `GET /api/enrollment/status/:orderId` to immediately receive the Google Classroom join link without phone verification or join token verification.
- **Suggested Fix:** Remove `classroomUrl` from `getEnrollmentStatus` response in `leadService.ts`. The Google Classroom link must ONLY be returned by `joinService.verify()` upon successful phone matching.
- **Confidence:** High

---

### High Severity

#### [SEC-03] Overly Permissive CORS Policy Allows Arbitrary Vercel Deployments & Substrings
- **File & Line:** `backend/src/app.ts:46-47`
- **What is wrong:** CORS origin callback permits any origin where `cleanOrigin.endsWith('.vercel.app')` or `cleanOrigin.includes('superprofit.in')`.
- **Exploitation:** Any third party can register a free account on Vercel (`attacker.vercel.app`) or register a domain containing `superprofit.in` (e.g., `superprofit.in.evil.com`) and make authenticated CORS requests with `credentials: true` to the backend.
- **Suggested Fix:** Replace substring and wildcard matching with an exact whitelist array:
  ```ts
  const allowedOrigins = [
    env.SITE_URL?.replace(/\/$/, ''),
    env.FRONTEND_URL?.replace(/\/$/, ''),
    'https://superprofit.in',
    'https://www.superprofit.in',
  ].filter(Boolean);
  if (allowedOrigins.includes(cleanOrigin) || (env.NODE_ENV === 'development' && cleanOrigin.includes('localhost'))) {
    return callback(null, true);
  }
  return callback(new Error('Blocked by CORS policy'));
  ```
- **Confidence:** High

#### [SEC-04] Payment Verification Does Not Confirm Payment Capture Status With Razorpay API
- **File & Line:** `backend/src/routes/paymentRoutes.ts:108-154`, `backend/src/routes/paymentRoutes.ts:185-224`
- **What is wrong:** Both `/api/verify-payment` and `/api/payment/verify` only verify the HMAC cryptographic signature of `orderId|paymentId`. Neither route queries the Razorpay API (`razorpayService.fetchPayment(paymentId)`) to verify that the payment is in status `captured`.
- **Exploitation:** If a transaction is authorized but auto-capture fails or is pending, or if an attacker supplies an authorized/refunded payment ID with a matching order signature, the system treats it as fully paid.
- **Suggested Fix:** Fetch the payment from Razorpay API and enforce status `captured`:
  ```ts
  const payment = await razorpayService.fetchPayment(payment_id);
  if (payment.status !== 'captured' && env.NODE_ENV !== 'test') {
    return res.status(400).json({ verified: false, error: 'Payment not captured' });
  }
  ```
- **Confidence:** High

#### [SEC-05] Supabase View `pending_joins` Lacks `security_invoker` and Permits Anon Reads
- **File & Line:** `backend/migrations/005_join_sessions_reminder.sql:42-57`
- **What is wrong:** The view `pending_joins` runs with owner privileges (`SECURITY DEFINER` default in Postgres) and bypasses RLS. In Supabase, newly created views in schema `public` grant `SELECT` to `anon` and `authenticated` roles by default.
- **Exploitation:** Anyone with the public Supabase anon key can make a GET request to `https://<supabase-id>.supabase.co/rest/v1/pending_joins` and dump customer names, order IDs, timestamps, and partial phone numbers.
- **Suggested Fix:** In `005_join_sessions_reminder.sql`, alter the view or add explicit revocations:
  ```sql
  ALTER VIEW pending_joins SET (security_invoker = true);
  REVOKE ALL ON pending_joins FROM anon, authenticated;
  GRANT SELECT ON pending_joins TO service_role;
  ```
- **Confidence:** High

#### [SEC-06] Webhook Crashes Unrecoverably If Order Row Missing in DB
- **File & Line:** `backend/src/services/enrollmentWorkflowService.ts:35-37`
- **What is wrong:** `handlePaymentSuccess` executes:
  ```ts
  const lookupRes = await client.query(`SELECT id, lead_id FROM payments WHERE razorpay_order_id = $1`, [orderId]);
  if (lookupRes.rows.length === 0) throw new Error(`Payment record not found for order: ${orderId}`);
  ```
  If database insertion failed during `/api/enrollment/create-order` (which logs `Could not persist payment to DB, proceeding with checkout`), no `payments` row exists when the webhook arrives.
- **Exploitation:** When the customer pays, Razorpay sends `order.paid` or `payment.captured`. The webhook crashes with a 500 error every time it retries. The customer is charged, but payment is never marked `PAID`, no invite is sent, and access is blocked.
- **Suggested Fix:** In `handlePaymentSuccess`, if the payment row is missing, insert a synthetic lead and payment record using order details from the Razorpay API/webhook notes before processing.
- **Confidence:** High

---

### Medium Severity

#### [SEC-07] Table `enrollments` Missing Explicit RLS Enable Statement
- **File & Line:** `backend/migrations/001_initial_schema.sql:194-200`
- **What is wrong:** Migration 001 enables RLS on `leads`, `payments`, `payment_events`, `classroom_enrollments`, `enrollment_attempts`, `enrollment_jobs`, but misses `enrollments`.
- **Exploitation:** If the `enrollments` table is exposed via PostgREST, anonymous clients could query enrolled student emails.
- **Suggested Fix:** Add `ALTER TABLE enrollments ENABLE ROW LEVEL SECURITY;` to migrations.
- **Confidence:** High

#### [SEC-08] Unbounded Outbound HTTP Request in WhatsApp Service Without Timeout
- **File & Line:** `backend/src/services/whatsappService.ts:98-100`
- **What is wrong:** Outbound `fetch` call to WaAPI (`https://waapi.app/api/v1/...`) has no timeout signal (`AbortSignal.timeout(...)`).
- **Exploitation:** If WaAPI stalls, rate-limits, or suffers an outage, outgoing webhook processing and background workers hang indefinitely on pending sockets, consuming server resources.
- **Suggested Fix:** Add `signal: AbortSignal.timeout(10000)` to the fetch call.
- **Confidence:** High

#### [SEC-09] `/api/create-order` Accepts Client-Supplied Currency Without Whitelist Validation
- **File & Line:** `backend/src/routes/paymentRoutes.ts:23`
- **What is wrong:** `const currency = (req.body.currency || 'INR').toUpperCase();` trusts the client request body for `currency` without asserting it equals `env.COURSE_CURRENCY` (`INR`).
- **Exploitation:** An attacker could submit an order with a non-INR currency if Razorpay account permits multiple currencies.
- **Suggested Fix:** Force `const currency = env.COURSE_CURRENCY || 'INR';`.
- **Confidence:** High

---

### Low Severity

#### [SEC-10] Admin Job Route `POST /api/jobs/retry-invites` Lacks Route-Level Rate Limiter
- **File & Line:** `backend/src/routes/jobRoutes.ts:21`
- **What is wrong:** Protected by `x-job-secret` header, but lacks a strict rate limiter (relies only on `globalLimiter` allowing 1000 req/15min).
- **Exploitation:** Enables brute-force enumeration of `x-job-secret` up to 1000 attempts per 15 minutes per IP.
- **Suggested Fix:** Apply a dedicated limiter (e.g. max 10 requests per 15 minutes).
- **Confidence:** Medium

#### [SEC-11] WhatsApp Retry Job Accumulates Unexpired Tokens Without Cleanup
- **File & Line:** `backend/src/services/whatsappService.ts:89`
- **What is wrong:** Each retry attempt calls `joinService.createToken()`, generating a new row in `join_tokens`. Old tokens are not invalidated.
- **Exploitation:** If an invite retries 5 times, 5 active, unexpired tokens exist for the same order simultaneously.
- **Suggested Fix:** Delete or expire previous unverified tokens for that order before creating a new one:
  `UPDATE join_tokens SET expires_at = NOW() WHERE order_id = $1 AND expires_at > NOW();`
- **Confidence:** High

---

## 4. Bugs (Logic & Reliability)

### High Severity

#### [BUG-01] Polling Timeout in `EnrollmentModal.tsx` Hardcodes Stale Course ID and Falsely Reports Success
- **File & Line:** `frontend/components/EnrollmentModal.tsx:299-306`
- **What is wrong:** If status polling reaches `maxAttempts` (75 seconds), it executes:
  ```ts
  if (attempts >= maxAttempts) {
    clearInterval(interval);
    setClassroomUrl("https://classroom.google.com/c/889084654883");
    setModalState("SUCCESS");
    setStatusMessage(`Invitation sent to ${formData.email}. Open Classroom and click Accept.`);
  }
  ```
- **Effect:** Falsely informs the user that invitation succeeded, and sets the classroom link to a stale course ID (`889084654883`), leading the student to a non-existent or wrong course.
- **Suggested Fix:** When polling times out, set `modalState("FAILED")` with a message instructing the user to check their email or contact support.
- **Confidence:** High

#### [BUG-02] Website Checkout Fast-Path Completely Bypasses Join Page & Phone Verification
- **File & Line:** `backend/src/routes/paymentRoutes.ts:148-154`, `frontend/components/EnrollmentModal.tsx:489-497`
- **What is wrong:** `/api/verify-payment` does not mint a site join token or return `joinUrl`. Inside `EnrollmentModal.tsx`, upon signature verification, the modal immediately displays the Classroom button and sets state to `SUCCESS`.
- **Effect:** The student on the website never experiences the `/join/[token]` verification page or phone number match that was requested. Only WhatsApp recipients go through phone verification.
- **Suggested Fix:** In `/api/verify-payment`, mint a join token via `joinService.createToken(paid.paymentRowId, order_id, 'site')` and return `{ verified: true, joinUrl }`. The frontend modal should redirect the user to `joinUrl` upon payment completion.
- **Confidence:** High

---

### Medium Severity

#### [BUG-03] Confirmation Countdown Timer Resets If Student Re-Clicks "Open Classroom"
- **File & Line:** `frontend/components/PendingJoinCard.tsx:93-96`
- **What is wrong:** In `handleOpenClassroom`, `setSecondsLeft(CONFIRM_WAIT_SECONDS)` is called unconditionally on every click.
- **Effect:** If a student opens Google Classroom, returns after 12 seconds, and clicks "Open Classroom" again to refresh the tab, their countdown timer is reset to 15 seconds, frustrating legitimate users.
- **Suggested Fix:** Only set `secondsLeft` if `!hasOpened`:
  ```ts
  if (!hasOpened) {
    setHasOpened(true);
    setSecondsLeft(CONFIRM_WAIT_SECONDS);
  }
  ```
- **Confidence:** High

---

### Low Severity

#### [BUG-04] Unhandled `localStorage.getItem` Exception In Private Browsing
- **File & Line:** `frontend/app/join/[token]/JoinClient.tsx:62`
- **What is wrong:** `localStorage.getItem("joinSession")` is called without a `try/catch` block inside the initial check effect.
- **Effect:** If storage is disabled or restricted in private browsing mode or sandboxed webviews, `localStorage.getItem` throws a `SecurityError`, causing `check()` to catch and prematurely mark the token as `invalid`.
- **Suggested Fix:** Wrap line 62 in a `try/catch` block or helper function.
- **Confidence:** High

---

## 5. Dependency Audit

### Backend (`backend/package.json`)
- **`vitest` / `@vitest/mocker` / `tinypool` / `esbuild`:** 10 vulnerabilities reported (2 critical, 1 high, 7 moderate).
  - *Risk Assessment:* These are development dependencies used strictly for running tests locally. They are **not** bundled into production or deployed to Render.
  - *Action:* Run `npm update vitest` in development when convenient.

### Frontend (`frontend/package.json`)
- **`next@14.2.35`:** Multiple CVEs flagged (Server Component DoS, Cache Poisoning, Image Optimizer DoS).
  - *Risk Assessment:* When deployed on Vercel, static page generation and edge routing mitigate many custom server vulnerabilities. However, updating to Next.js 14.2.x latest patch is advised.
- **`tailwindcss` / `braces`:** High severity RegExp DoS in build-time tooling. Not reachable in production runtime.

---

## 6. Checked & Verified Secure

The following critical areas were rigorously checked and verified to be safe:

1. **Secret Leakage in Git History:** Thorough regex search across all commits and branches confirmed that `RAZORPAY_KEY_SECRET`, `SUPABASE_SERVICE_ROLE_KEY`, `GOOGLE_REFRESH_TOKEN`, `GOOGLE_CLIENT_SECRET`, and `SMTP_PASS` have **never** been committed to git history.
2. **Environment File Protection:** `.env`, `.env.local`, and `.env.*` are excluded in `.gitignore` and have never been committed. `.env.example` contains only harmless placeholders.
3. **No Private Secrets in Browser Bundles:** `NEXT_PUBLIC_` variables are limited to `NEXT_PUBLIC_BACKEND_URL` and `NEXT_PUBLIC_RAZORPAY_KEY_ID` (which is public by design).
4. **Payment Amount Immutability:** Order creation on backend (`/api/create-order` and `/api/enrollment/create-order`) forces `env.COURSE_PRICE_PAISE` (349900 paise / ₹3,499). Client-provided amounts in request bodies are ignored.
5. **HMAC Timing-Safe Signatures:** `crypto.timingSafeEqual` is properly utilized for both payment signature and webhook signature validation in `razorpayService.ts`.
6. **SQL Injection Immunity:** All database queries in `backend/src/` use parameterized inputs (`$1`, `$2`, etc.). Zero raw string interpolation in SQL queries.
7. **Join Token Security:** Join tokens and session tokens are generated with 256 bits of CSPRNG entropy (`crypto.randomBytes(32)`). Only SHA-256 hashes are persisted in the database.
8. **Anti-Brute Force Lockout:** Phone verification queries lock the order row `FOR UPDATE` within a database transaction; 5 failed attempts trigger an automatic 60-minute lockout (`join_locked_until`).
9. **SEO & Referrer Sanitization:** Join pages (`/join/[token]` and `/join/continue`) specify `robots: { index: false, follow: false }` and `referrer: "no-referrer"`, preventing token leakage via referrer headers.

---

## 7. Pre-Push Action Checklist

Before pushing this repository to GitHub, execute the following steps:

- [ ] **Step 1: Rotate Google Classroom Invite Code**
  - Open Google Classroom -> Settings -> General -> Invite code -> Click **Reset**.
  - Copy new invite link and update `GCR_LINK` in backend Render dashboard and local `.env`.
- [ ] **Step 2: Clean Hardcoded Link from Code**
  - In `frontend/components/EnrollmentModal.tsx`, remove `DEFAULT_GCR_URL` and stale course ID `889084654883`.
  - In `backend/src/services/joinService.ts`, remove hardcoded fallback `ODkxODYwMDQwMzQw` / `435t7z2a`.
- [ ] **Step 3: Restrict `GET /api/enrollment/status/:orderId`**
  - Remove `classroomUrl` from `leadService.ts:106, 125, 134`.
- [ ] **Step 4: Tighten CORS in `backend/src/app.ts`**
  - Remove `.endsWith('.vercel.app')` and `.includes('superprofit.in')`. Whitelist explicit origins only.
- [ ] **Step 5: Secure Database View `pending_joins`**
  - Run in Supabase SQL editor:
    ```sql
    ALTER VIEW pending_joins SET (security_invoker = true);
    REVOKE ALL ON pending_joins FROM anon, authenticated;
    ```
- [ ] **Step 6: Remove Extraneous Root Files**
  - Delete `server.js` and `schema.sql` from the repository root (they contain redundant, out-of-sync logic).
- [ ] **Step 7: GitHub Repository Settings**
  - Ensure the repository is set to **Private** unless intentionally public.
  - In GitHub repo Settings -> **Code security and analysis**:
    - Enable **Secret scanning**.
    - Enable **Push protection**.
