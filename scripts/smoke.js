/**
 * Smoke test script for backend routes.
 * Hits /health and primary endpoints with invalid inputs to verify status codes without touching payments.
 * Usage: node scripts/smoke.js [baseUrl]
 */

const BASE_URL = process.argv[2] || process.env.BACKEND_URL || 'http://localhost:5000';

async function runCheck(name, fn) {
  try {
    const ok = await fn();
    if (ok) {
      console.log(`[PASS] ${name}`);
      return true;
    } else {
      console.error(`[FAIL] ${name}`);
      return false;
    }
  } catch (err) {
    console.error(`[ERR]  ${name}:`, err.message);
    return false;
  }
}

async function main() {
  console.log(`Running smoke checks against: ${BASE_URL}\n`);

  let passed = 0;
  let total = 0;

  const checks = [
    {
      name: 'GET /health returns 200 with status ok',
      fn: async () => {
        const res = await fetch(`${BASE_URL}/health`);
        const json = await res.json().catch(() => ({}));
        return res.status === 200 && json.status === 'ok';
      },
    },
    {
      name: 'GET /api/join/check without token returns 400',
      fn: async () => {
        const res = await fetch(`${BASE_URL}/api/join/check`);
        return res.status === 400;
      },
    },
    {
      name: 'POST /api/join/verify with empty payload returns 400',
      fn: async () => {
        const res = await fetch(`${BASE_URL}/api/join/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        return res.status === 400;
      },
    },
    {
      name: 'GET /api/join/status without authorization returns 401',
      fn: async () => {
        const res = await fetch(`${BASE_URL}/api/join/status`);
        return res.status === 401;
      },
    },
    {
      name: 'POST /api/payment/verify without signature returns 400',
      fn: async () => {
        const res = await fetch(`${BASE_URL}/api/payment/verify`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        return res.status === 400;
      },
    },
    {
      name: 'POST /api/webhooks/razorpay without signature header returns 400',
      fn: async () => {
        const res = await fetch(`${BASE_URL}/api/webhooks/razorpay`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });
        return res.status === 400;
      },
    },
    {
      name: 'GET /unknown-path returns 404',
      fn: async () => {
        const res = await fetch(`${BASE_URL}/unknown-path-smoke-test`);
        return res.status === 404;
      },
    },
  ];

  for (const check of checks) {
    total++;
    const ok = await runCheck(check.name, check.fn);
    if (ok) passed++;
  }

  console.log(`\nSmoke summary: ${passed}/${total} passed.`);
  if (passed !== total) process.exit(1);
}

main().catch((err) => {
  console.error('Fatal smoke test error:', err);
  process.exit(1);
});
