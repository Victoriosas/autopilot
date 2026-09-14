import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { sourcingConfig, type Evidence } from '../src/autopilot/sourcingEvidence';
import { runSourcing, type SourcingDependencies } from '../src/autopilot/sourcingOrchestrator';
import type { SourcingStore } from '../src/autopilot/sourcingStore';

const database=process.env.AUTOPILOT_TEST_DATABASE_URL;
const psql=process.env.PSQL_PATH || 'psql';
function sql(query:string):Promise<string>{
 return new Promise((resolve,reject)=>{
  const child=execFile(psql,[database!,'-X','-q','-A','-t','-v','ON_ERROR_STOP=1'],{windowsHide:true},(err,out,stderr)=>err?reject(new Error(stderr)):resolve(out.trim()));
  child.stdin!.end(query);
 });
}
const quoted=(value:unknown)=>`'${JSON.stringify(value).replace(/'/g,"''")}'::jsonb`;
const store:SourcingStore={async command(command,args){return JSON.parse(await sql(`set role service_role; select public.autopilot_sourcing_command('${command}',${quoted(args)});`));}};
const config={...sourcingConfig({}),minMargin:35,durationMs:40000,maxCandidates:30};
function fixture(id=randomUUID()):Evidence {
 return {provider:'cj',productId:id,variantId:'one',sourceUrl:'https://example.test/evidence',observedAt:new Date().toISOString(),
 currency:'UYU',stock:10,supplierCost:10,shippingCost:2,destination:'UY',shippingVerified:true,imageRightsVerified:true,
 candidate:{id,title:'Vincha de rutina',risk:'low',demandScore:95,supplierReliabilityScore:95,logisticsScore:95,competitionScore:5,
 evidence:{demand:'verified',supplierReliability:'verified',logistics:'verified',competition:'verified'},pricing:{supplierCost:10,supplierShipping:2,
 customsRatePct:0,paymentFeePct:4,paymentFeeFixed:0,returnReservePct:4,acquisitionCost:0,taxRatePct:0,currency:'UYU',targetNetMarginPct:35,
 marketPrice:40,provenance:{supplierCost:'verified',supplierShipping:'verified',marketPrice:'verified'}}},
 facts:{description:'Vincha de tela para sujetar el cabello durante la rutina.',images:['https://example.test/headband.jpg']}};
}
const approve:SourcingDependencies['council']=async()=>({decision:'approve',quorum:'3_of_3',votes:[],debatePerformed:false,summary:'Synthetic test approval',ownerEscalationRequired:false,escalationReasons:[]});

test('PostgreSQL durable sourcing integration', {skip:!database,timeout:240000}, async t=>{
 const target=new URL(database!);
 assert.ok(['localhost','127.0.0.1'].includes(target.hostname),'Only loopback databases allowed');
 assert.equal(target.pathname,'/autopilot_orchestrator_test','Dedicated disposable database required');
 // Dedicated database/schema only. No remote or existing app schema is eligible.
 await sql('drop schema public cascade; create schema public;');
 await sql(readFileSync('tests/sourcing-baseline.sql','utf8'));
 for(const file of ['20260912051000_autopilot_product_drafts.sql','20260912052500_ai_governor_draft_reviews.sql','20260912054500_governed_publication.sql','20260912200316_release_integrity.sql','20260914215143_durable_sourcing_orchestrator.sql'])
  await sql(readFileSync(`supabase/migrations/${file}`,'utf8'));
 await sql('grant usage on schema public to service_role,anon,authenticated; grant select,insert,update on products,autopilot_product_drafts to service_role;');
 const expire=async()=>sql("update autopilot_sourcing_runs set lease_expires_at=now()-interval '1 second' where status in ('running','resuming');");
 const clean=async()=>sql('truncate autopilot_sourcing_items,autopilot_sourcing_runs,autopilot_product_drafts,products cascade;');

 await t.test('concurrent claim, lease takeover and stale fencing',async()=>{
  const args={scope:'cj:UY',key:'concurrency',mode:'shadow',config};
  const results=await Promise.all([store.command('claim',{...args,owner:randomUUID()}),store.command('claim',{...args,owner:randomUUID()})]);
  assert.equal(results.filter(r=>r.status==='claimed').length,1);
  const old=results.find(r=>r.status==='claimed').run;
  await expire();
  const next=await store.command('claim',{...args,owner:randomUUID()});
  assert.equal(next.run.id,old.id);assert.equal(next.run.lease_generation,old.lease_generation+1);
  await assert.rejects(store.command('discover',{run:old.id,owner:old.lease_owner,generation:old.lease_generation,items:[]}),/FENCE_REJECTED/);
  await clean();
 });
 await t.test('30 unknown candidates complete successfully without drafts',async()=>{
  const unknown=Array.from({length:30},()=>({...fixture(),currency:null,shippingCost:null}));
  const result=await runSourcing(store,config,'empty',{discover:async()=>unknown,council:approve});
  assert.equal(result.status,'completed_no_candidates');
  assert.equal(await sql("select count(*) from autopilot_sourcing_items where status='needs_evidence';"),'30');
  assert.equal(await sql('select count(*) from products;'),'0');
  await clean();
 });
 for(const stage of ['discovered','normalized','evidence_validated','opportunity_scored','pricing_completed','draft_created','council_approved','shadow_completed']){
  await t.test(`crash after ${stage} resumes without duplicate effects`,async()=>{
   const evidence=fixture();let crashed=false;
   const deps:SourcingDependencies={discover:async()=>[evidence],council:approve,afterCheckpoint(s){if(s===stage&&!crashed){crashed=true;throw new Error('SIMULATED_CRASH');}}};
   await assert.rejects(runSourcing(store,config,stage,deps),/SIMULATED_CRASH/);
   await expire();
   const resumed=await runSourcing(store,config,stage,{...deps,afterCheckpoint:undefined});
   assert.equal(resumed.status,'completed');
   const replay=await runSourcing(store,config,stage,deps);assert.equal(replay.status,'replayed');
   assert.equal(await sql('select count(*) from autopilot_product_drafts;'),'1');
   assert.equal(await sql('select count(*) from products;'),'0');
   assert.equal(await sql("select count(*) from autopilot_sourcing_items where status='shadow_completed';"),'1');
   await assert.rejects(sql("set role service_role; select publish_autopilot_draft((select id from autopilot_product_drafts limit 1));"),/SHADOW_PUBLICATION_DENIED/);
   await assert.rejects(sql('update autopilot_product_drafts set created_in_shadow_mode=false,publication_eligible=true;'),/IMMUTABLE_DRAFT_ORIGIN/);
   await clean();
  });
 }
 await t.test('production publication, crash replay and commercial identity deduplication',async()=>{
  const evidence=fixture();const prod={...config,mode:'production' as const};
  await assert.rejects(runSourcing(store,prod,'prod',{discover:async()=>[evidence],council:approve,afterCheckpoint(s){if(s==='published')throw new Error('SIMULATED_CRASH');}}),/SIMULATED_CRASH/);
  await expire();await runSourcing(store,prod,'prod',{discover:async()=>[evidence],council:approve});
  assert.equal(await sql('select count(*) from products;'),'1');
  assert.equal(await sql('select inventory from products;'),'0');
  await runSourcing(store,prod,'prod-new',{discover:async()=>[{...evidence,observedAt:new Date(Date.now()+1).toISOString()}],council:approve});
  assert.equal(await sql('select count(*) from products;'),'1');
  await clean();
 });
 await t.test('anonymous roles cannot access internal state or commands',async()=>{
  await assert.rejects(sql('set role anon; select * from autopilot_sourcing_runs;'),/permission denied/);
  await assert.rejects(sql("set role authenticated; select autopilot_sourcing_command('status','{}');"),/permission denied/);
 });
});
