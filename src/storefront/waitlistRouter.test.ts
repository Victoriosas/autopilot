import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createStorefrontWaitlistRouter } from './waitlistRouter';

test('waitlist validates consent and email, and fails safely for unavailable configuration', async () => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const app = express();
  app.use(express.json());
  app.use('/waitlist', createStorefrontWaitlistRouter());
  const server = createServer(app).listen(0, '127.0.0.1');
  await once(server, 'listening');
  const { port } = server.address() as { port: number };
  const post = (body: unknown) => fetch(`http://127.0.0.1:${port}/waitlist`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body), signal: AbortSignal.timeout(1500),
  });
  try {
    for (const [body, status, expected] of [
      [{ website: 'bot.example' }, 202, { ok: true }],
      [{ email: 'invalid', consent: true }, 400, { error: 'WAITLIST_EMAIL_INVALID' }],
      [{ email: 'buyer@example.test', consent: 'true' }, 400, { error: 'WAITLIST_CONSENT_REQUIRED' }],
      [{ email: 'buyer@example.test', consent: true }, 503, { error: 'WAITLIST_UNAVAILABLE' }],
    ] as const) {
      const response = await post(body);
      assert.equal(response.status, status);
      assert.deepEqual(await response.json(), expected);
    }
    process.env.SUPABASE_URL = 'invalid-url';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-only-placeholder';
    const response = await post({ email: 'buyer@example.test', consent: true });
    assert.equal(response.status, 503);
    assert.deepEqual(await response.json(), { error: 'WAITLIST_UNAVAILABLE' });
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
