import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {runHealth,requestToken} from './agent-health-queue.mjs';
test('OIDC worker audience is fixed',async()=>{
 const token=await requestToken({url:'https://github.example.org/oidc',token:'ephemeral',fetcher:async(u,opts)=>{
  assert.equal(u.searchParams.get('audience'),'victoriosas-six-agent-health');
  assert.equal(opts.headers.authorization,'Bearer ephemeral');
  return {ok:true,json:async()=>({value:'signed'})};
 }});assert.equal(token,'signed');
});
test('bounded worker response accepted',async()=>{
 const r=await runHealth({tokenProvider:async()=> 'signed',fetcher:async(u,opts)=>{
  assert.equal(u.pathname,'/functions/v1/six-agent-health-worker');assert.equal(opts.method,'POST');
  return {ok:true,json:async()=>({state:'completed',task_id:'six-health:infrastructure:123',evidence:'site_http_200_brand_verified'})};
 }});assert.equal(r.state,'completed');
});
test('unauthorized and malicious worker response fail closed',async()=>{
 await assert.rejects(runHealth({tokenProvider:async()=> 'signed',fetcher:async()=>({ok:false,status:403})}),/worker_http_403/);
 await assert.rejects(runHealth({tokenProvider:async()=> 'signed',fetcher:async()=>({ok:true,json:async()=>({state:'completed',task_id:'other',evidence:'site_http_200_brand_verified'})})}),/worker_result_unverified/);
});
test('cannot redirect execution to another database',async()=>await assert.rejects(runHealth({url:'https://bad.example.org/',tokenProvider:async()=> 'x'}),/unapproved_supabase_project/));
test('Edge worker pins issuer, repository, exact workflow and safe task action',()=>{
 const src=readFileSync(new URL('../supabase/functions/six-agent-health-worker/index.ts',import.meta.url),'utf8');
 for(const fragment of ['jwtVerify(',"algorithms:['RS256']",'1365196828','workflow_ref','refs/heads/main','read_only_public_health','six_agent_claim_public_health','six_agent_complete','six_agent_fail']){
  assert.ok(src.includes(fragment),fragment);
 }
 assert.ok(!src.includes('consultation_requests'));assert.ok(!src.includes('consultation_reply_outbox'));
});
