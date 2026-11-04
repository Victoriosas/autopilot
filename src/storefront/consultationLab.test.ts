import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createConsultationRouter } from './consultationRouter';
import { runConsultationLab, syntheticConsultation } from './consultationLab';
import { validateServiceKnowledge } from './consultationServiceKnowledge';
import { approvedConsultationFacts } from './consultationEvidence';

test('laboratory reuses shadow guards even if simulated understanding reports no risks', async () => {
  for (const [id, risk] of [['guarantee','RISK_EFFICACY'],['injection','RISK_INJECTION'],['clinical','RISK_HEALTH']]) {
    const result = await runConsultationLab(id, { facts: approvedConsultationFacts });
    assert.ok(result.analysis.guardian.codes.includes(risk));
    assert.equal(result.analysis.decision.action, 'no_send');
    assert.equal(result.stages.length, 0, 'risk prevented all external processing');
    assert.equal(result.reviewRequired, true);
  }
});
test('only fixed cases can reach laboratory; no consent, credentials or free text bypass', async () => {
  assert.throws(() => syntheticConsultation('customer text'), /LAB_CASE_INVALID/);
  const blocked = await runConsultationLab('no-consent', { facts: approvedConsultationFacts });
  assert.equal(blocked.stages.length, 0);
  assert.ok(blocked.analysis.guardian.codes.includes('MODEL_UNAVAILABLE_OR_INVALID'));
  await assert.rejects(runConsultationLab('general', { facts: [], provider: { id: 'camelrun', model: 'paid-model', configVersion: 'x', remote: true, complete: async () => { throw Error('must not call'); } } }), /REMOTE_CONTRACT_UNVERIFIED/);
});
test('successful simulation shows three stages, source versions and honest zero-cost telemetry', async () => {
  const result = await runConsultationLab('general', { facts: approvedConsultationFacts });
  assert.equal(result.mode, 'simulation');
  assert.deepEqual(result.stages.map(s => s.stage), ['understand','draft','review']);
  assert.equal(result.analysis.provider.id, 'synthetic-simulation');
  assert.equal(result.usage.inputTokens, null);
  assert.equal(result.usage.actualCostUsd, 0);
  assert.equal(result.remote.available, false);
  assert.ok(result.analysis.evidence.every(f => f.version && f.source));
  assert.equal(result.analysis.decision.action, 'no_send');
});
test('private knowledge rejects missing approval evidence, unknown services and expired versions', () => {
  const entry = { slug:'limpieza-profunda',version:0,description:'',techniques:'',duration:'',conditions:'',faq:'',internalFee:'',approvedForAI:false,priceApproved:false,validUntil:null };
  assert.deepEqual(validateServiceKnowledge(entry),entry);
  for (const mutation of [{slug:'invented'},{approvedForAI:true},{priceApproved:true},{validUntil:'2000-01-01'},{version:-1},{publication_status:'published'}]) {
    assert.throws(() => validateServiceKnowledge({...entry,...mutation}), /KNOWLEDGE_INPUT_INVALID/);
  }
});
test('unsafe approved evidence never becomes a draft or a price quote', async () => {
  const base=approvedConsultationFacts.find(f=>f.service==='limpieza-profunda')!;
  for(const fragment of ['Cuesta 999 UYU.','La tarifa es de mil pesos.','Te garantizamos resultados.','En tu caso te indico peeling.']) {
    const result=await runConsultationLab('general',{facts:[{...base,fragment}]});
    assert.ok(result.analysis.guardian.codes.includes('EVIDENCE_POLICY_BLOCK'));
    assert.ok(!result.analysis.drafts.some(d=>d.text.includes(fragment)));
  }
});
test('admin lab authenticates, verifies origin and refuses customer payloads without touching delivery', async () => {
  let deliveries = 0, reads = 0;
  const app = express();
  app.use('/inquiries',createConsultationRouter({ origin:()=>'https://victoriosas.online',
    auth:(req,res,next)=>req.get('authorization')==='Bearer synthetic-admin'?next():res.sendStatus(401),
    knowledge:{list:async()=>[],save:async()=>true,facts:async()=>{reads++;return [];}},
    delivery:{ready:()=>true,send:async()=>{deliveries++;return 'unexpected';}},
    store:{ready:async()=>true,claim:async()=>{throw Error('must not write real consultations');},finish:async()=>false},
  }));
  const server=app.listen(0,'127.0.0.1');await once(server,'listening');
  const url=`http://127.0.0.1:${(server.address() as any).port}/inquiries/admin/lab`;
  const headers={authorization:'Bearer synthetic-admin',origin:'https://victoriosas.online','content-type':'application/json','x-consultation-lab':'synthetic-v1'};
  const post=(body:unknown,override={})=>fetch(url,{method:'POST',headers:{...headers,...override},body:JSON.stringify(body)});
  try {
    assert.equal((await post({caseId:'general'},{authorization:''})).status,401);
    assert.equal((await post({caseId:'general'},{origin:'https://attacker.test'})).status,403);
    for(const body of [{caseId:'general',message:'real data'},{caseId:'general',requestId:'real-id'},{caseId:'general',mode:'camelrun'},{caseId:'missing'}]) assert.equal((await post(body)).status,400);
    assert.equal(reads,0);
    const response=await post({caseId:'price'});assert.equal(response.status,200);
    const result=await response.json();assert.equal(result.delivery,'NOT_SENT');assert.ok(result.analysis.guardian.codes.includes('EVIDENCE_INSUFFICIENT'));
    assert.equal(deliveries,0);
  } finally { server.closeAllConnections();await new Promise<void>(r=>server.close(()=>r())); }
});

test('synthetic lab remains usable with zero facts when the private knowledge schema is unavailable', async () => {
  let deliveries = 0, knowledgeReads = 0;
  const app = express();
  app.use('/inquiries', createConsultationRouter({
    origin: () => 'https://victoriosas.online',
    auth: (req, res, next) => req.get('authorization') === 'Bearer synthetic-admin' ? next() : res.sendStatus(401),
    knowledge: {
      list: async () => { throw Error('private schema missing'); },
      save: async () => { throw Error('private schema missing'); },
      facts: async () => { knowledgeReads++; throw Error('private schema missing'); },
    },
    delivery: { ready: () => true, send: async () => { deliveries++; return 'unexpected'; } },
    store: { ready: async () => true, claim: async () => { throw Error('must not store'); }, finish: async () => false },
  }));
  const server = app.listen(0, '127.0.0.1'); await once(server, 'listening');
  const url = `http://127.0.0.1:${(server.address() as any).port}/inquiries/admin/lab`;
  const headers = {
    authorization: 'Bearer synthetic-admin',
    origin: 'https://victoriosas.online',
    'content-type': 'application/json',
    'x-consultation-lab': 'synthetic-v1',
  };
  try {
    const unauthenticated = await fetch(url, { method: 'POST', headers: {...headers, authorization: ''}, body: JSON.stringify({ caseId: 'general' }) });
    assert.equal(unauthenticated.status, 401);
    const response = await fetch(url, { method: 'POST', headers, body: JSON.stringify({ caseId: 'general' }) });
    assert.equal(response.status, 200);
    const result = await response.json();
    assert.equal(result.mode, 'simulation');
    assert.equal(result.knowledgeUnavailable, true);
    assert.equal(result.remote.available, false);
    assert.equal(result.delivery, 'NOT_SENT');
    assert.equal(result.reviewRequired, true);
    assert.equal(result.analysis.evidence.length, 0);
    assert.equal(knowledgeReads, 1);
    assert.equal(deliveries, 0);
    const editor = await fetch(url + '/knowledge', { headers });
    assert.equal(editor.status, 503, 'private editor must fail closed until the schema is installed');
  } finally {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
