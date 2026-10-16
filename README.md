# Super Profit — WhatsApp Invite & Personal Join Portal Setup

## 1. Supabase Database Migration
In your Supabase project dashboard, navigate to **SQL Editor** and run:
1. `backend/migrations/004_join_tokens_whatsapp.sql`
2. `backend/migrations/005_join_sessions_reminder.sql`

These migrations are purely additive:
- Adds `customer_phone`, `wa_status`, `wa_error`, `wa_attempts`, `join_failed_attempts`, `join_locked_until`, `join_reveal_count`, `customer_name_submitted`, `customer_email_submitted`, `classroom_opened_at`, and `joined_confirmed_at` to the `payments` table.
- Creates `join_tokens` and `join_sessions` tables with Row Level Security enabled (backend service role only).
- Creates the `pending_joins` view for tracking customers who paid but haven't confirmed joining.

---

## 2. Environment Variables

### Backend (Render Web Service)
Set these in your Render Dashboard under **Environment**:

| Variable | Description | Example / Note |
|---|---|---|
| `NODE_ENV` | Environment mode | `production` |
| `PORT` | Listening port | `5000` |
| `DATABASE_URL` | Supabase Postgres Session Pooler URI | `postgresql://postgres:[PASSWORD]@[HOST]:5432/postgres?sslmode=require` |
| `SUPABASE_URL` | Supabase Project URL | `https://your-project.supabase.co` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase secret key (bypass RLS) | `eyJh...` |
| `SITE_URL` | Canonical frontend domain (for `/join/[token]`) | `https://your-frontend.vercel.app` |
| `FRONTEND_URL` | Allowed frontend origin for CORS | `https://your-frontend.vercel.app` |
| `RAZORPAY_KEY_ID` | Razorpay API Key ID | `rzp_test_...` or `rzp_live_...` |
| `RAZORPAY_KEY_SECRET` | Razorpay API Key Secret | `your_razorpay_secret` |
| `RAZORPAY_WEBHOOK_SECRET` | Secret configured in Razorpay Webhooks | `your_webhook_secret` |
| `COURSE_PRICE_PAISE` | Course price in paise (must match checkout) | `349900` (for ₹3,499) |
| `COURSE_CURRENCY` | Currency | `INR` |
| `SEND_WHATSAPP` | Enable/disable WhatsApp messaging | `true` |
| `WAAPI_TOKEN` | API token from waapi.app/user/api-tokens | `Bearer token string` |
| `WAAPI_INSTANCE_ID` | Linked instance ID from waapi.app | `12345` |
| `GCR_LINK` | Google Classroom join link (revealed on verify) | `https://classroom.google.com/c/XXXX?cjc=XXXX` |
| `JOB_SECRET` | Secret string protecting `/jobs/retry-invites` | Any long random string |
| `JOIN_TOKEN_TTL_DAYS` | Days before join link expires | `30` (default) |
| `MAX_REVEALS` | Max allowed Classroom link unlocks per order | `3` (default) |
| `CONFIRM_MIN_SECONDS` | Delay before student can click 'I've joined' | `15` (default) |
| `JOIN_SESSION_TTL_DAYS` | Days before sessionToken expires | `30` (default) |
| `MAX_SESSIONS_PER_ORDER` | Max concurrent active sessions per order | `3` (default) |

### Frontend (Vercel)
Set these in your Vercel Project Settings under **Environment Variables**:

| Variable | Description | Example |
|---|---|---|
| `NEXT_PUBLIC_BACKEND_URL` | URL of your deployed Render backend | `https://your-backend.onrender.com` |
| `NEXT_PUBLIC_RAZORPAY_KEY_ID` | Razorpay Key ID for checkout popup | `rzp_test_...` or `rzp_live_...` |

---

## 3. Razorpay Webhook Configuration
1. Log in to your [Razorpay Dashboard](https://dashboard.razorpay.com).
2. Go to **Settings -> Webhooks -> Add New Webhook**.
3. **Webhook URL:** `https://your-backend.onrender.com/api/webhooks/razorpay` (or `https://your-backend.onrender.com/webhooks/razorpay`)
4. **Secret:** Enter a strong random secret and set it as `RAZORPAY_WEBHOOK_SECRET` on Render.
5. **Active Events:**
   - `payment.captured` (Primary event that marks order paid, mints join token, and sends WhatsApp message)
   - `order.paid`
   - `payment.failed`

---

## 4. End-to-End Testing in Razorpay Test Mode

1. **Activate Test Mode:**
   - In Razorpay Dashboard, toggle the switch in the top bar to **Test Mode**.
   - Copy `rzp_test_...` key and secret to your backend and frontend environment variables.

2. **Complete a Test Order:**
   - Visit your site and open the enrollment modal.
   - Enter your name, valid Indian mobile (e.g. `9876543210` or `+91 98765 43210`), and email.
   - Check the required **"I agree to receive course updates on WhatsApp"** checkbox.
   - Click **Proceed to Secure Pay**.
   - In the Razorpay test modal, select **UPI** or **Netbanking**, click **Success**.

3. **Verify Immediate Fast-Path Redirect:**
   - Once payment succeeds, the frontend automatically redirects you to `https://your-site/join/<token>`.
   - On this page, click **Join Now**.
   - Enter your name, email, and the **same mobile number** used during checkout.
   - The backend checks your phone number against the paid record (without revealing the paid number or classroom link to unauthorized users).
   - Upon matching, the Google Classroom link is securely returned with an **Open Classroom** button.

4. **Verify WhatsApp Dispatch:**
   - Check your WhatsApp number linked to WaAPI.
   - The message confirms payment and includes the direct link `https://your-site/join/<token>`.

5. **Test Retry Endpoint:**
   - Run:
     ```bash
     curl -X POST -H "x-job-secret: $JOB_SECRET" https://your-backend.onrender.com/api/jobs/retry-invites
     ```
   - Retries any orders paid > 2 minutes ago with `wa_status` pending or failed (up to 5 attempts, with 3–6s spacing).

6. **Test "Join the Classroom" Reminder & Confirmation Flow:**
   - After phone verification on `/join/<token>`, the page transitions to the non-dismissible **"Please join the Classroom to complete your enrollment"** pending screen.
   - Click **Open Classroom** (opens in a new tab; calls `POST /api/join/opened`).
   - Notice the **"I've joined the Classroom"** button is disabled with a 15-second countdown timer.
   - Switch tabs to Google Classroom, then switch back to your site tab — the button highlights with `"Did you join? Tap here to confirm."`.
   - Try reloading or closing the tab — the browser displays a standard `"Leave site?"` `beforeunload` alert.
   - Navigate to `/` — notice the sticky `PendingJoinBanner` displays at the top of every page with a link to `/join/continue`.
   - Open `/join/continue` — it resumes your pending session seamlessly without asking for phone or email again.
   - Once the 15-second timer completes, click **"I've joined the Classroom"** (calls `POST /api/join/confirm`).
   - The session token is cleared from `localStorage`, `beforeunload` is removed, the sticky banner disappears across the site, and the page displays `"You're all set. Welcome to the course!"`.
   - Revisit `/join/<token>` — it displays `"You've already joined"`.
