import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeConsultation, checkExactAnswer, conversationVersion } from './consultationIntelligence';
import { approvedConsultationFacts } from './consultationEvidence';
import { intelligenceEvaluation } from './consultationIntelligence.eval';
import { intelligenceFixture } from './consultationIntelligence.fixtures';
const now = new Date('2026-10-24T01:00:00Z');

for (const [id,message,topics,risk] of intelligenceEvaluation) test(`intelligence frozen ${id}: ${message}`, async () => {
 const result = await analyzeConsultation(intelligenceFixture(message), {now});
 assert.equal(result.mode,'shadow'); assert.equal(result.decision.action,'no_send');
 assert.deepEqual(new Set(result.understanding.questions.map(q=>q.topic)),new Set(topics.split(',')));
 if(risk !== 'none') assert.ok(result.understanding.risks.includes(risk),risk);
 assert.equal(result.drafts.length,3);
 for(const draft of result.drafts) {
  const check = checkExactAnswer(result,intelligenceFixture(message),draft.text,now);
  if(result.guardian.status==='approved')assert.equal(check.status,'approved');
 }
});
test('evidence is versioned and every accepted commercial claim has approved support',async()=>{
 const result=await analyzeConsultation(intelligenceFixture('Qué incluye el masaje relax y cuánto sale'),{now});
 assert.ok(result.evidence.length>=2);
 for(const item of result.evidence){assert.equal(item.approval,'approved');assert.ok(item.source&&item.owner&&item.version&&item.fragment);}
 assert.deepEqual(result.drafts.map(d=>[...d.factIds].sort()),Array(3).fill([...result.drafts[0].factIds].sort()));
});
test('expired, draft and contradictory knowledge cannot authorize an answer',async()=>{
 for(const facts of [approvedConsultationFacts.map(f=>({...f,approval:'draft' as const})),approvedConsultationFacts.map(f=>({...f,validUntil:'2026-01-01T00:00:00Z'})),[...approvedConsultationFacts,{...approvedConsultationFacts[0],version:'conflict',fragment:'Una condición contradictoria.'}]]){
  const result=await analyzeConsultation(intelligenceFixture(),{now,facts});
  assert.notEqual(result.guardian.status,'approved');
 }
});
test('exact answer validation rejects edits, recipients, new context and stale evidence',async()=>{
 const record=intelligenceFixture(), result=await analyzeConsultation(record,{now});
 assert.equal(checkExactAnswer(result,record,result.drafts[0].text,now).status,'approved');
 for(const text of [result.drafts[0].text+' Cuesta 2000 UYU.','Resultados garantizados. Victoria | Victoriosas','Visitá https://example.com. Victoria | Victoriosas'])assert.notEqual(checkExactAnswer(result,record,text,now).status,'approved');
 assert.notEqual(checkExactAnswer(result,{...record,input:{...record.input,email:'different@example.com'}},result.drafts[0].text,now).status,'approved');
 assert.notEqual(checkExactAnswer(result,{...record,input:{...record.input,message:'Otra pregunta'}},result.drafts[0].text,now).status,'approved');
 assert.notEqual(checkExactAnswer(result,record,result.drafts[0].text,new Date('2027-01-01')).status,'approved');
 assert.notEqual(conversationVersion(record),conversationVersion({...record,input:{...record.input,consentVersion:'changed' as any}}));
});
test('provider failure, malformed output and overriden risk all fail closed without network fallback',async()=>{
 for(const complete of [async()=>{throw Error('private provider detail');},async()=>({role:'admin'}),async()=>({topics:['price'],serviceCandidates:[],risks:[],confidence:1,notes:[]})]){
  const result=await analyzeConsultation(intelligenceFixture('Precios si estoy embarazada'),{now,provider:{id:'fixture',model:'synthetic',configVersion:'test-v1',complete}});
  assert.notEqual(result.guardian.status,'approved'); assert.equal(result.decision.action,'no_send');
  assert.ok(!JSON.stringify(result).includes('private provider detail'));
 }
});
test('valid structured model cannot add facts or disable deterministic guards',async()=>{
 let calls=0;
 const provider={id:'fixture',model:'synthetic',configVersion:'eval-v1',complete:async(stage:string,payload:any)=>{
  calls++;return stage==='understand'?{topics:['price'],serviceCandidates:['masaje-relax'],risks:[],confidence:0.99,notes:[]}:stage==='draft'?{texts:payload.allowedDrafts}:{status:'approved',codes:[]};
 }};
 const result=await analyzeConsultation(intelligenceFixture(),{now,provider});assert.equal(result.guardian.status,'approved');assert.equal(calls,3);
 for(const stage of ['understand','draft','review']){
  const adversarial={...provider,complete:async(s:string,payload:any)=>s!==stage?provider.complete(s,payload):stage==='understand'?{topics:['price'],serviceCandidates:['invented'],risks:[],confidence:1,notes:[]}:stage==='draft'?{texts:['Precio 1500','Otra','Tercera']}:{status:'approved',codes:['missing_evidence']}};
  assert.notEqual((await analyzeConsultation(intelligenceFixture(),{now,provider:adversarial})).guardian.status,'approved');
 }
});
test('remote model cannot run without durable budget and does not receive contact fields',async()=>{
 let calls=0;const provider={id:'fixture',model:'synthetic',configVersion:'v1',remote:true,complete:async(_stage:string,payload:any)=>{calls++;assert.ok(!JSON.stringify(payload).includes('synthetic@example.com'));throw Error('fixture');}};
 assert.notEqual((await analyzeConsultation(intelligenceFixture(),{now,provider})).guardian.status,'approved');assert.equal(calls,0);
 await analyzeConsultation(intelligenceFixture('Precios, mi correo es synthetic@example.com'),{now,provider,reserveBudget:async()=>true});assert.equal(calls,1);
});

test('missing AI opt-in, expired records and sensitive messages make zero model calls and zero budget reservations', async()=>{
 let calls=0,reservations=0;
 const provider={id:'fixture',model:'synthetic',configVersion:'v1',remote:true,complete:async()=>{calls++;return {};}};
 for(const record of [
  {...intelligenceFixture(),input:{...intelligenceFixture().input,aiConsent:false}},
  {...intelligenceFixture(),expires_at:'2026-01-01T00:00:00Z'},
  intelligenceFixture('Estoy embarazada y quiero consultar precios'),
 ]){
  const result=await analyzeConsultation(record,{now,provider,reserveBudget:async()=>{reservations++;return true;}});
  assert.equal(result.guardian.status,'blocked');assert.equal(result.decision.action,'no_send');
 }
 assert.equal(calls,0);assert.equal(reservations,0);
});
