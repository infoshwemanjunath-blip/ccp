// Express backend: Razorpay webhook -> WhatsApp (WaAPI, waapi.app) GCR invite
// Install: npm i express razorpay @supabase/supabase-js   (Node 18+)
//
// Env vars (set on Render):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
//   RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET
//   COURSE_PRICE_PAISE        e.g. 99900 for Rs 999
//   WAAPI_TOKEN               from waapi.app/user/api-tokens (all scopes)
//   WAAPI_INSTANCE_ID         the instance connected to your number via QR
//   GCR_LINK                  your Google Classroom join link
//   JOB_SECRET                any long random string (protects retry endpoint)

const express = require('express');
const crypto = require('crypto');
const Razorpay = require('razorpay');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const rzp = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

// ---------- helpers ----------

// Accepts "98765 43210", "+91 98765-43210", "09876543210" -> "919876543210"
function normalizePhone(input) {
  let d = String(input || '').replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
  if (d.length === 10) d = '91' + d;
  return /^91[6-9]\d{9}$/.test(d) ? d : null;
}

function inviteText(order) {
  return (
    `Hi ${order.name}! 🎉 Your payment is confirmed. Welcome to the course.\n\n` +
    `Join your Google Classroom here:\n${process.env.GCR_LINK}\n\n` +
    `If you have any trouble joining, just reply to this message.`
  );
}

async function sendInvite(order) {
  let status = 'failed';
  let errText = null;

  try {
    const r = await fetch(
      `https://waapi.app/api/v1/instances/${process.env.WAAPI_INSTANCE_ID}/client/action/send-message`,
      {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.WAAPI_TOKEN}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          chatId: `${order.phone}@c.us`, // 91XXXXXXXXXX@c.us
          message: inviteText(order),
        }),
      }
    );
    const body = await r.json().catch(() => ({}));

    // WaAPI has two status fields: HTTP/outer `status` (did it reach the instance)
    // and `data.status` (did the instance actually send). The inner one decides.
    const ok = r.ok && body.status !== 'error' && body.data?.status !== 'error';
    if (ok) status = 'sent';
    else errText = JSON.stringify(body).slice(0, 500) || `HTTP ${r.status}`;
  } catch (e) {
    errText = e.message;
  }

  await supabase
    .from('orders')
    .update({
      wa_status: status,
      wa_error: errText,
      wa_attempts: (order.wa_attempts || 0) + 1,
    })
    .eq('id', order.id);

  return status;
}

// ---------- Razorpay webhook (RAW body needed for signature check) ----------
// Keep this ABOVE express.json()

app.post('/webhooks/razorpay', express.raw({ type: 'application/json' }), async (req, res) => {
  const signature = req.headers['x-razorpay-signature'] || '';
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_WEBHOOK_SECRET)
    .update(req.body)
    .digest('hex');

  const valid =
    signature.length === expected.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
  if (!valid) return res.status(400).send('Invalid signature');

  const event = JSON.parse(req.body.toString());
  if (event.event !== 'payment.captured') return res.sendStatus(200);

  const payment = event.payload.payment.entity;

  // Idempotent: only the first call flips pending -> paid, repeats get no row back
  const { data: order, error } = await supabase
    .from('orders')
    .update({
      status: 'paid',
      razorpay_payment_id: payment.id,
      paid_at: new Date().toISOString(),
    })
    .eq('razorpay_order_id', payment.order_id)
    .eq('status', 'pending')
    .select()
    .maybeSingle();

  if (error) return res.sendStatus(500); // Razorpay will retry
  res.sendStatus(200);                   // reply fast, then send
  if (order) await sendInvite(order);
});

// ---------- normal JSON routes ----------
app.use(express.json());

// Frontend calls this when the form is submitted, before opening Razorpay checkout
app.post('/create-order', async (req, res) => {
  try {
    const { name, email } = req.body;
    const phone = normalizePhone(req.body.phone);
    if (!name || !email || !phone) {
      return res.status(400).json({ error: 'Invalid name, email or phone' });
    }

    const rzpOrder = await rzp.orders.create({
      amount: Number(process.env.COURSE_PRICE_PAISE),
      currency: 'INR',
      receipt: `rcpt_${Date.now()}`,
    });

    const { error } = await supabase
      .from('orders')
      .insert({ name, email, phone, razorpay_order_id: rzpOrder.id });
    if (error) throw error;

    res.json({ orderId: rzpOrder.id, amount: rzpOrder.amount, key: process.env.RAZORPAY_KEY_ID });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: 'Could not create order' });
  }
});

// Retries failed/unsent invites. Hit every 5 min with a Render Cron Job:
//   curl -X POST -H "x-job-secret: $JOB_SECRET" https://YOUR-APP.onrender.com/jobs/retry-invites
app.post('/jobs/retry-invites', async (req, res) => {
  if (req.headers['x-job-secret'] !== process.env.JOB_SECRET) return res.sendStatus(401);

  const twoMinAgo = new Date(Date.now() - 2 * 60 * 1000).toISOString();
  const { data } = await supabase
    .from('orders')
    .select('*')
    .eq('status', 'paid')
    .in('wa_status', ['pending', 'failed'])
    .lt('wa_attempts', 5)
    .lt('paid_at', twoMinAgo);

  for (const o of data || []) {
    await sendInvite(o);
    await new Promise((r) => setTimeout(r, 3000 + Math.random() * 3000)); // 3-6s gap
  }
  res.json({ retried: (data || []).length });
});

app.get('/health', (_req, res) => res.send('ok'));

app.listen(process.env.PORT || 3000, () => console.log('Server running'));
