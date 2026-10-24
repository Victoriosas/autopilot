import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeConsultation, checkExactAnswer, conversationVersion } from './consultationIntelligence';
import { approvedConsultationFacts } from './consultationEvidence';
import { intelligenceEvaluation } from './consultationIntelligence.eval';
import type { ConsultationRecord } from './consultationSupabase';

export const intelligenceFixture = (message = 'Precio del masaje relax'): ConsultationRecord => ({
 id:'88888888-8888-4888-8888-888888888888', created_at:'2026-10-24T00:00:00Z', expires_at:'2026-11-20T00:00:00Z',
 input:{id:'88888888-8888-4888-8888-888888888888',fullName:'Caso sintético',phone:'+59899123456',email:'synthetic@example.com',age:30,service:'orientacion',message,responseChannel:'email',consent:true,consentVersion:'consultation-v1',website:''},
});
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
