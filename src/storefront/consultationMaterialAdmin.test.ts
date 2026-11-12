import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { registerConsultationMaterialAdmin } from './consultationMaterialAdminRouter';
import { createMaterialAdminStore } from './consultationMaterialAdmin';

const id = '11111111-1111-4111-8111-111111111111';
test('material admin denies anon/client/lost session and enforces approval, shape, CAS, no-store and no retry', async () => {
  let calls = 0, fail = false, saved = true;
  const app = express(), router = express.Router();
  registerConsultationMaterialAdmin(router, () => 'https://victoriosas.online', {
    snapshot: async token => { calls++; assert.equal(token, 'synthetic-admin'); if (fail) throw Error('private'); return []; },
    review: async (token, request, material, updated, state) => { calls++; assert.equal(token, 'synthetic-admin'); assert.equal(request, id); assert.equal(material, id); assert.equal(updated, '2026-11-12T00:00:00Z'); assert.equal(state, 'revoked'); if (fail) throw Error('private'); return saved; },
    purge: async (_token, request) => { calls++; assert.equal(request, id); return 1; },
  }, (req, res, next) => req.get('authorization') === 'Bearer synthetic-admin' ? next() : res.status(req.get('authorization') === 'Bearer synthetic-client' ? 403 : 401).end());
  app.use(router);
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as any).port}/admin/${id}/material`;
  const headers = { authorization: 'Bearer synthetic-admin', origin: 'https://victoriosas.online', 'x-consultation-approval': id, 'content-type': 'application/json' };
  const post = (body: unknown, extra = headers) => fetch(url + '/review', { method: 'POST', headers: extra, body: JSON.stringify(body) });
  const body = { id, updated_at: '2026-11-12T00:00:00Z', state: 'revoked' };
  try {
    for (const authorization of ['', 'Bearer synthetic-client', 'Bearer expired-session']) {
      assert.ok([401,403].includes((await fetch(url, { headers: { authorization } })).status));
      assert.ok([401,403].includes((await post(body, { ...headers, authorization })).status));
    }
    assert.equal(calls, 0);
    assert.equal((await post(body, { ...headers, origin: 'https://other.invalid' })).status, 403);
    assert.equal((await post(body, { ...headers, 'x-consultation-approval': 'wrong' })).status, 403);
    for (const value of [{ ...body, state: 'send' }, { ...body, recipient: 'forbidden' }, { ...body, updated_at: '' }, { ...body, id: 'bad' }]) assert.equal((await post(value)).status,400);
    assert.equal(calls, 0);
    const read = await fetch(url, { headers }); assert.equal(read.status,200); assert.equal(read.headers.get('cache-control'),'no-store'); assert.deepEqual(await read.json(),{rows:[],delivery_decision:'no_send'});
    assert.equal((await post(body)).status,200);
    saved = false; assert.equal((await post(body)).status,409);
    fail = true; const before = calls;
    const uncertain = await post(body); assert.equal(uncertain.status,503); assert.equal(calls,before+1); assert.ok(!(await uncertain.text()).includes('private'));
    assert.equal((await fetch(url,{headers})).status,503);
    assert.equal((await fetch(url+'/purge',{method:'POST',headers,body:'{}'})).status,200);
  } finally { server.closeAllConnections(); await new Promise<void>(resolve=>server.close(()=>resolve())); }
});

test('material admin adapter passes only the caller token and scoped RPC parameters', async () => {
  const calls: unknown[] = [];
  const store = createMaterialAdminStore(((token: string) => ({ rpc: async (name: string, params: unknown) => { calls.push({token,name,params}); return { data: name.endsWith('snapshot') ? [] : true, error: null }; } })) as any);
  await assert.rejects(store.snapshot('',id)); assert.equal(calls.length,0);
  await store.snapshot('caller',id); await store.review('caller',id,id,'exact-server-time','revoked'); await store.purge('caller',id);
  assert.deepEqual(calls,[{token:'caller',name:'consultation_material_admin_snapshot',params:{p_request:id}}, {token:'caller',name:'consultation_material_admin_review',params:{p_request:id,p_id:id,p_updated:'exact-server-time',p_state:'revoked'}}, {token:'caller',name:'consultation_material_admin_purge',params:{p_request:id}}]);
});
