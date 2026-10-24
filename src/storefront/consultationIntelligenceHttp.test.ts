import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { once } from 'node:events';
import { createConsultationRouter } from './consultationRouter';
import { intelligenceFixture } from './consultationIntelligence.fixtures';
import type { IntelligenceStore } from './consultationIntelligenceStore';
test('shadow HTTP authorization, durable analysis and exact review never call delivery',async()=>{
 const record=intelligenceFixture(),run='99999999-9999-4999-8999-999999999999';let enabled=true,visible=true,deliveries=0,saved:any=null;
 const memory:IntelligenceStore={claim:async()=>saved?{state:'ready',id:run,analysis:saved}:{state:'claimed',id:run,lease:run},finish:async(_id,_lease,analysis)=>{saved=analysis;return true;},get:async()=>saved?{id:run,analysis:saved}:null,review:async()=>true,reserve:async()=>false,report:async()=>({runs:saved?1:0,actualCost:null})};
 const app=express();app.use('/inquiries',createConsultationRouter({
  origin:()=> 'https://victoriosas.online',
  auth:(req,res,next)=>{if(req.get('authorization')!=='Bearer fixture-admin')return res.status(401).json({error:'ADMIN_AUTH_REQUIRED'});res.locals.adminUserId=run;next();},
  store:{ready:async()=>true,claim:async()=>({state:'accepted'}),finish:async()=>true,get:async()=>visible?record:null},
  delivery:{ready:()=>true,send:async()=>{deliveries++;return 'fixture';}},
  intelligence:{enabled:()=>enabled,store:memory,now:()=>new Date('2026-10-24T01:00:00Z')},
 }));
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${(server.address() as any).port}/inquiries`;
 const headers={'authorization':'Bearer fixture-admin',origin:'https://victoriosas.online','content-type':'application/json','x-consultation-approval':record.id};
 const post=(path:string,body:unknown={},overrides={})=>fetch(base+'/admin/'+record.id+'/intelligence'+path,{method:'POST',headers:{...headers,...overrides},body:JSON.stringify(body)});
 try{
  assert.equal((await post('',{}, {authorization:''})).status,401);
  assert.equal((await post('',{}, {origin:'https://attacker.test'})).status,403);
  assert.equal((await post('',{role:'admin'})).status,400);
  enabled=false;assert.equal((await post('')).status,503);enabled=true;
  visible=false;assert.equal((await post('')).status,404);visible=true;
  const response=await post('');assert.equal(response.status,200);const result=await response.json();
  assert.equal(result.analysis.mode,'shadow');assert.equal(deliveries,0);
  assert.equal((await post('/'+run+'/review',{text:result.analysis.drafts[0].text+' precio 1000',action:'approve'})).status,409);
  const review=await post('/'+run+'/review',{text:result.analysis.drafts[0].text,action:'approve'});assert.equal(review.status,200);
  assert.equal((await review.json()).status,'approved_for_review_only');assert.equal(deliveries,0);
  const report=await fetch(base+'/admin/intelligence-report',{headers});assert.equal(report.status,200);
 }finally{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));}
});
