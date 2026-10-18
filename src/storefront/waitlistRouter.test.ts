import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { createStorefrontWaitlistRouter } from './waitlistRouter';

test('waitlist validates consent and email, and fails safely for unavailable configuration', async (t) => {
  const previousUrl = process.env.SUPABASE_URL;
  const previousKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  const app = express();
  app.use(express.json());
  app.use('/waitlist', createStorefrontWaitlistRouter({enabled:()=>true}));
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

    process.env.SUPABASE_URL = 'https://waitlist.example.test';
    const nativeFetch = globalThis.fetch;
    let mode: 'success' | 'database-error' | 'network-error' = 'success';
    let saved: Record<string, unknown> | undefined;
    t.mock.method(globalThis, 'fetch', async (input: Parameters<typeof fetch>[0], init?: RequestInit) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.hostname === '127.0.0.1') return nativeFetch(input, init);
      assert.equal(url.hostname, 'waitlist.example.test', 'no real provider calls allowed');
      assert.equal(url.pathname, '/rest/v1/storefront_waitlist');
      assert.equal(init?.method, 'POST');
      saved = JSON.parse(String(init?.body));
      if (mode === 'network-error') throw new Error('simulated transport failure');
      if (mode === 'database-error') return Response.json({ code: 'TEST_ERROR' }, { status: 500 });
      return new Response(null, { status: 201 });
    });
    const success = await post({ email: ' BUYER@EXAMPLE.TEST ', consent: true, interest: 'unknown', source: '<launch>' });
    assert.equal(success.status, 202);
    assert.deepEqual(await success.json(), { ok: true });
    assert.equal(saved?.email, 'buyer@example.test');
    assert.equal(saved?.interest, 'general');
    assert.equal(saved?.source, 'launch');
    assert.equal(saved?.consent_launch_updates, true);
    for (const failure of ['database-error', 'network-error'] as const) {
      mode = failure;
      const failed = await post({ email: 'buyer@example.test', consent: true, interest: 'facial_accessories' });
      assert.equal(failed.status, 503);
      assert.deepEqual(await failed.json(), { error: 'WAITLIST_UNAVAILABLE' });
    }
  } finally {
    if (previousUrl === undefined) delete process.env.SUPABASE_URL;
    else process.env.SUPABASE_URL = previousUrl;
    if (previousKey === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    else process.env.SUPABASE_SERVICE_ROLE_KEY = previousKey;
    server.closeAllConnections();
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});


test('waitlist defaults closed before reading personal data or contacting Supabase', async (t) => {
  const previousEnabled=process.env.WAITLIST_ENABLED;
  delete process.env.WAITLIST_ENABLED;
  let bodyReads=0,providerCalls=0;
  const nativeFetch=globalThis.fetch;
  t.mock.method(globalThis,'fetch',async(input:Parameters<typeof fetch>[0],init?:RequestInit)=>{
    const url=new URL(input instanceof Request?input.url:String(input));
    if(url.hostname==='127.0.0.1')return nativeFetch(input,init);
    providerCalls++;throw new Error('disabled waitlist must not contact provider');
  });
  const app=express();
  app.use((req,_res,next)=>{Object.defineProperty(req,'body',{get(){bodyReads++;throw new Error('disabled waitlist must not inspect data');}});next();});
  app.use('/waitlist',createStorefrontWaitlistRouter());
  const server=createServer(app).listen(0,'127.0.0.1');await once(server,'listening');
  try{
    const {port}=server.address() as {port:number};
    const response=await fetch(`http://127.0.0.1:${port}/waitlist`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({email:'synthetic@example.test',consent:true}),signal:AbortSignal.timeout(1500)});
    assert.equal(response.status,503);assert.deepEqual(await response.json(),{error:'WAITLIST_DISABLED'});
    assert.equal(bodyReads,0);assert.equal(providerCalls,0);
  }finally{
    if(previousEnabled===undefined)delete process.env.WAITLIST_ENABLED;else process.env.WAITLIST_ENABLED=previousEnabled;
    server.closeAllConnections();await new Promise<void>((resolve,reject)=>server.close(error=>error?reject(error):resolve()));
  }
});
