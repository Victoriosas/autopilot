import test from 'node:test';
import assert from 'node:assert/strict';
import { runConsultationIntelligence, reviewConsultationIntelligence, type IntelligenceStore } from './consultationIntelligenceStore';
import { intelligenceFixture } from './consultationIntelligence.fixtures';
test('persistent orchestration claims once and cannot return a result from another conversation',async()=>{
 let writes=0; const saved:any[]=[];
 const store:IntelligenceStore={claim:async(id,version,config)=>{if(writes++)return {state:'busy'};return {state:'claimed',id:'run-fixture',lease:'lease-fixture'};},finish:async(id,lease,result)=>{saved.push(result);return true;},get:async()=>null,review:async()=>false,reserve:async()=>true,report:async()=>({})};
 const results=await Promise.all(Array.from({length:8},()=>runConsultationIntelligence(intelligenceFixture(),{store,now:new Date('2026-10-24')})));
 assert.equal(results.filter(r=>r.state==='ready').length,1);assert.equal(saved.length,1);
 store.claim=async()=>({state:'ready',id:'wrong',analysis:{...saved[0],conversationVersion:'wrong'}});
 await assert.rejects(runConsultationIntelligence(intelligenceFixture(),{store}),/STALE/);
});
test('review requires exact answer and conversation before persisting an approval',async()=>{
 let approvals=0;let analysis:any;
 const store:IntelligenceStore={claim:async()=>({state:'claimed',id:'run-fixture',lease:'lease-fixture'}),finish:async(_id,_lease,result)=>{analysis=result;return true;},get:async()=>({id:'run-fixture',analysis}),review:async()=>{approvals++;return true;},reserve:async()=>true,report:async()=>({})};
 const record=intelligenceFixture(), now=new Date('2026-10-24');
 await runConsultationIntelligence(record,{store,now});
 const rejected=await reviewConsultationIntelligence(record,'run-fixture','admin-fixture',analysis.drafts[0].text+' inventado', {store,now});
 assert.equal(rejected.guardian.status,'blocked'); assert.equal(approvals,0);
 const accepted=await reviewConsultationIntelligence(record,'run-fixture','admin-fixture',analysis.drafts[0].text,{store,now});
 assert.equal(accepted.guardian.status,'approved');assert.equal(accepted.status,'approved_for_review_only');assert.equal(approvals,1);
});
