import test from 'node:test';
import assert from 'node:assert/strict';
import {runCloudOffice,cloudRpcClient} from './cloudRuntimeV3';
import {createCloudTrigger} from './cloudTrigger';
import {readCloudStatus} from './cloudStatusReader';
import {diagnosePublicHealth,networkFailure} from './publicHealthDiagnostic';
const sha='a'.repeat(40),token='11111111-1111-4111-8111-111111111111';
test('health separates DNS TLS timeout HTTP content and bounds body; never retries or redirects',async()=>{
 for(const [code,expected] of [['ENOTFOUND','dns'],['EAI_AGAIN','dns'],['CERT_HAS_EXPIRED','tls'],['ERR_TLS_CERT_ALTNAME_INVALID','tls'],['ETIMEDOUT','timeout'],['ECONNRESET','network']])assert.equal(networkFailure({cause:{code}}),expected);
 assert.equal(networkFailure({name:'TimeoutError'}),'timeout');
 assert.equal(networkFailure({message:'client error (Connect): dns error: failed to lookup address'}),'dns');
 assert.equal(networkFailure({message:'invalid peer certificate: UnknownIssuer'}),'tls');
 for(const [response,expected] of [[new Response('',{status:302}),'http'],[new Response('Victoriosas'),'unexpected_content'],[new Response('Otro sitio',{headers:{'content-type':'text/html'}}),'unexpected_content'],[new Response('x'.repeat(524289),{headers:{'content-type':'text/html'}}),'unexpected_content'],[new Response('Victoriosas',{headers:{'content-type':'text/html'}}),'ok']] as const){
  let calls=0;
  const result=await diagnosePublicHealth((async(url,opts)=>{calls++;assert.equal(url,'https://victoriosas.online/');assert.equal(opts?.redirect,'manual');return response;}) as typeof fetch);
  assert.equal(result.code,expected);assert.equal(calls,1);
 }
 assert.equal((await diagnosePublicHealth((async()=>{throw {cause:{code:'ENOTFOUND'},message:'secret'};}) as typeof fetch)).code,'dns');
});
test('cloud runtime claims six roles, executes five bounded adapters and fences every result',async()=>{
 const calls:string[]=[];let health=0;
 const rpc=async(name:string,args:Record<string,unknown>)=>{
  calls.push(name);
  if(name==='cloud_v3_start')return {task_id:'cloud-v3:123:director',claim_token:token,agent:'director'};
  if(name==='cloud_v3_claim')return {task_id:'cloud-v3:123:'+args.p_agent,claim_token:token,agent:args.p_agent};
  if(name==='cloud_v3_measure')return {kind:'aggregate',count:0};
  if(name==='cloud_v3_finish')return true;
  throw Error('unexpected_rpc');
 };
 const config={enabled:true,reviewedSha:sha,artifactSha:sha,rpc,health:async()=>{health++;return {code:'ok' as const,status:200,healthy:true};}};
 assert.deepEqual(await runCloudOffice(config),{state:'cycle_recorded',tasksClaimed:6,noSend:true});
 assert.equal(health,1);assert.equal(calls.filter(x=>x==='cloud_v3_finish').length,6);
 await assert.rejects(runCloudOffice({...config,enabled:false}),/disabled/);
 await assert.rejects(runCloudOffice({...config,artifactSha:'b'.repeat(40)}),/unreviewed/);
 await assert.rejects(runCloudOffice({...config,rpc:async(n,a)=>n==='cloud_v3_finish'?false:rpc(n,a)}),/fenced/);
 assert.equal((await runCloudOffice({...config,rpc:async()=>null})).tasksClaimed,0);
 await assert.rejects(runCloudOffice({...config,rpc:async()=>({task_id:'legacy-blocked',claim_token:token,agent:'director'})}),/invalid_cloud_claim/);
});
test('cloud trigger rejects preflight token, wrong methods and disabled runtime with no effects',async()=>{
 let configurations=0;
 const handler=createCloudTrigger({token:'cloud-'+ 'c'.repeat(40),runtime:()=>{configurations++;throw Error('not_configured');}});
 const base='https://edge.invalid/autopilot-director-wake/run';
 assert.equal((await handler(new Request(base))).status,405);
 assert.equal((await handler(new Request(base,{method:'POST',headers:{'x-autopilot-wake-token':'cloud-'+ 'c'.repeat(40)}}))).status,401);
 assert.equal(configurations,0);
 assert.equal((await handler(new Request(base,{method:'POST',headers:{'x-autopilot-cloud-token':'cloud-'+ 'c'.repeat(40)}}))).status,503);
 assert.equal(configurations,1);
});
test('RPC transport only calls pinned procedures, rejects redirects and redacts response errors',async()=>{
 let calls=0;
 const client=cloudRpcClient({url:'https://isolated.supabase.invalid',apiKey:'public-key',jwt:'scoped-jwt',fetcher:(async(url,opts)=>{
  calls++;assert.equal(String(url),'https://isolated.supabase.invalid/rest/v1/rpc/cloud_v3_status');assert.equal(opts?.redirect,'error');
  assert.equal(new Headers(opts?.headers).get('authorization'),'Bearer scoped-jwt');return new Response('private-error',{status:403});
 }) as typeof fetch});
 await assert.rejects(client('six_agent_claim',{}),/denied/);assert.equal(calls,0);
 await assert.rejects(client('cloud_v3_status',{}),/^Error: cloud_rpc_rejected$/);assert.equal(calls,1);
 assert.throws(()=>cloudRpcClient({url:'http://unsafe.invalid',apiKey:'key',jwt:'jwt'}));
});
test('status reader rejects duplicate roles, future heartbeat and strips unexpected evidence',async t=>{
 const env={AUTOPILOT_STATUS_URL:'https://isolated.supabase.invalid',AUTOPILOT_STATUS_API_KEY:'public',AUTOPILOT_STATUS_READER_JWT:'reader'};
 const agents=['director','software','infrastructure','consultations','followup','reports'].map(id=>({id,pending:0,running:0,blocked:1,completed:0,lastHeartbeat:null,results:0,lastResult:null}));
 const body={source:'supabase',scope:'cloud_v3_read_only',environment:'isolated',generatedAt:new Date().toISOString(),partial:false,agents,private:'secret'};
 t.mock.method(globalThis,'fetch',async()=>Response.json(body));
 const status=await readCloudStatus(env);assert.equal('private' in status,false);assert.equal(status.agents.length,6);
 agents[1].id='director';await assert.rejects(readCloudStatus(env),/INVALID/);
 agents[1].id='software';agents[0].lastHeartbeat='2999-01-01T00:00:00Z';await assert.rejects(readCloudStatus(env),/INVALID/);
 await assert.rejects(readCloudStatus({SUPABASE_SERVICE_ROLE_KEY:'must-not-fallback'}),/NOT_CONFIGURED/);
});
