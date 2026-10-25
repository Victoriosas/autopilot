import test from 'node:test';
import assert from 'node:assert/strict';
import { prepareIntelligenceOperations,validateWorkflowEvent } from './consultationIntelligenceOperations';
const now=new Date('2026-10-24T12:00:00Z');
const event=(kind:string,days:number,key=kind)=>({kind,key,payload:{occurredAt:new Date(+now-days*86400000).toISOString(),consentReference:'11111111-1111-4111-8111-111111111111'}});
test('followup requires recorded consent, real events, no optout and at most two proposals',()=>{
 assert.equal(prepareIntelligenceOperations([event('proposal_confirmed',3)],now).followups.length,0);
 const history=[event('consent_recorded',4),event('proposal_confirmed',3)];
 assert.equal(prepareIntelligenceOperations(history,now).followups.length,1);
 assert.equal(prepareIntelligenceOperations([...history,event('opt_out',1)],now).followups.length,0);
 assert.equal(prepareIntelligenceOperations([...history,event('followup_proposed',1,'one'),event('followup_proposed',1,'two')],now).followups.length,0);
 assert.equal(prepareIntelligenceOperations([event('consent_recorded',4),event('session_confirmed',2)],now).followups[0].kind,'post_session');
 assert.equal(prepareIntelligenceOperations([event('consent_recorded',4),event('session_confirmed',-1)],now).followups.length,0);
});
test('operations produce only sourced content drafts and non-identifiable learning proposals',()=>{
 const result=prepareIntelligenceOperations([],now);
 assert.equal(result.content.length,3);assert.ok(result.content.every(d=>d.status==='draft'&&d.factIds.length>0));
 assert.equal(result.reactivationEnabled,false);
 assert.equal(validateWorkflowEvent({kind:'consent_recorded',key:'a'.repeat(64),payload:{occurredAt:now.toISOString(),consentReference:'11111111-1111-4111-8111-111111111111'}},now),true);
 assert.equal(validateWorkflowEvent({kind:'consent_recorded',key:'a'.repeat(64),payload:{occurredAt:now.toISOString(),email:'private@example.com'}},now),false);
 assert.equal(validateWorkflowEvent({kind:'system',key:'a'.repeat(64),payload:{}},now),false);
});
