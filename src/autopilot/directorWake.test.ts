import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectorWakeHandler } from './directorWake';

const secret = 'a'.repeat(48);
const path = 'https://example.supabase.co/functions/v1/autopilot-director-wake';
const make = (token = secret, method = 'POST', url = path) =>
  new Request(url, { method, headers: { 'x-autopilot-wake-token': token } });

test('unconfigured wake cannot run even with supplied token', async () => {
  assert.equal((await createDirectorWakeHandler({token: undefined})(make())).status, 503);
});
test('wake rejects wrong token and short token', async () => {
  const handler = createDirectorWakeHandler({token: secret});
  for (const token of ['bad','b'.repeat(48),'']) {
    assert.equal((await handler(make(token))).status, 401);
  }
});
test('wake denies unsupported method, alternate and ambiguous paths', async () => {
  const handler = createDirectorWakeHandler({token: secret});
  assert.equal((await handler(make(secret, 'GET'))).status,405);
  for (const url of [
    path + '/dispatch', path+'/', path+'?x=1/dispatch',
    'https://example.supabase.co/alternate/autopilot-director-wake',
    'https://example.supabase.co/functions/v1/AUTOPILOT-DIRECTOR-WAKE',
    'https://example.supabase.co/functions/v1/%61utopilot-director-wake',
  ]) {
    // Query parameters are unrelated to route identity.
    const response=await handler(make(secret,'POST',url));
    assert.equal(response.status, url.includes('?') ? 200 : 404, url);
  }
});
test('valid wake is preflight only, never execution receipt', async () => {
  const handler = createDirectorWakeHandler({
    token: secret,now:()=>new Date('2026-11-22T05:00:00Z')
  });
  const response = await handler(make());
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(), {
    state:'wake_preflight_authenticated',executed:false,tasksClaimed:0,
    noSend:true,at:'2026-11-22T05:00:00.000Z'
  });
});
