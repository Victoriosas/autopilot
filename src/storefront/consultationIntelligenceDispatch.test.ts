import test from 'node:test';
import assert from 'node:assert/strict';
import { dispatchIntelligenceReply,decideIntelligenceAutonomy } from './consultationIntelligenceDispatch';
import { intelligenceFixture } from './consultationIntelligence.fixtures';
import { analyzeConsultation,approvalFingerprint } from './consultationIntelligence';
test('levels 0/1/2 cannot bypass shadow, review, evidence or evaluation gates',()=>{
 assert.equal(decideIntelligenceAutonomy({level:0,shadow:true,approved:true,safe:true,evaluated:true,categoryEnabled:true}),'no_send');
 assert.equal(decideIntelligenceAutonomy({level:1,shadow:false,approved:false,safe:true,evaluated:true,categoryEnabled:true}),'human_review');
 assert.equal(decideIntelligenceAutonomy({level:2,shadow:false,approved:false,safe:true,evaluated:false,categoryEnabled:true}),'human_review');
 assert.equal(decideIntelligenceAutonomy({level:2,shadow:false,approved:false,safe:false,evaluated:true,categoryEnabled:true}),'human_review');
});
test('dispatch uses exact approval and existing one-shot outbox; shadow and edits never deliver',async()=>{
 const record=intelligenceFixture(),now=new Date('2026-10-24');const analysis=await analyzeConsultation(record,{now});
 const text=analysis.drafts[0].text,hash=approvalFingerprint(analysis,record,text);let sent=0,claimed=false;
 const deps={now,env:{CONSULTATION_INTELLIGENCE_LIVE_REVIEW_ENABLED:'true'},load:async()=>({analysis,approvedText:text,approvalHash:hash,approvedBy:'admin'}),claim:async()=>{if(claimed)return false;claimed=true;return true;},send:async()=>{sent++;return 'sent' as const;}};
 assert.equal(await dispatchIntelligenceReply(record,'run','admin',hash,{...deps,env:{}}),'shadow');assert.equal(sent,0);
 assert.equal(await dispatchIntelligenceReply(record,'run','admin','invalid',deps),'blocked');assert.equal(sent,0);
 assert.equal(await dispatchIntelligenceReply(record,'run','admin',hash,{...deps,load:async()=>({analysis,approvedText:text+' edit',approvalHash:hash,approvedBy:'admin'})}),'blocked');
 assert.equal(await dispatchIntelligenceReply(record,'run','admin',hash,deps),'sent');assert.equal(sent,1);
 assert.equal(await dispatchIntelligenceReply(record,'run','admin',hash,deps),'already_processing');assert.equal(sent,1);
});
