// GitHub OIDC gated, single-purpose infrastructure health worker.
// No arbitrary task input, customer records, outbound customer messages or LLM calls.
import {createRemoteJWKSet,jwtVerify} from 'npm:jose@5.9.6';
const ISSUER='https://token.actions.githubusercontent.com';
const JWKS=createRemoteJWKSet(new URL(ISSUER+'/.well-known/jwks'));
const AUDIENCE='victoriosas-six-agent-health';
const WORKFLOW='Victoriosas/autopilot/.github/workflows/victoriosas-infrastructure-availability.yml@refs/heads/main';
const respond=(status:number,body:Record<string,unknown>)=>new Response(JSON.stringify(body),{
 status,headers:{'content-type':'application/json','cache-control':'no-store','x-content-type-options':'nosniff'}
});
function serviceKey():string{
 const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');if(legacy)return legacy;
 const current=Deno.env.get('SUPABASE_SECRET_KEYS');
 if(current){const parsed=JSON.parse(current);if(typeof parsed.default==='string')return parsed.default;}
 return '';
}
async function rest(path:string,body:Record<string,unknown>,prefer?:string):Promise<unknown>{
 const base=Deno.env.get('SUPABASE_URL'); const key=serviceKey();
 if(!base||!key)throw Error('server_config_missing');
 const headers:Record<string,string>={apikey:key,'content-type':'application/json','accept':'application/json'};
 if(key.startsWith('eyJ'))headers.authorization='Bearer '+key;
 if(prefer)headers.prefer=prefer;
 const r=await fetch(new URL('/rest/v1/'+path,base),{
  method:'POST',headers,body:JSON.stringify(body),signal:AbortSignal.timeout(8000)
 });
 if(!r.ok)throw Error('database_operation_rejected');
 if(prefer?.includes('return=minimal'))return null;
 return await r.json();
}
async function publicSiteHealthy():Promise<boolean>{
 const r=await fetch('https://victoriosas.online/',{
  method:'GET',redirect:'manual',headers:{accept:'text/html'},signal:AbortSignal.timeout(12000)
 });
 return r.status===200 && (await r.text()).includes('Victoriosas');
}
async function work():Promise<Record<string,unknown>>{
 const slot=Math.floor(Date.now()/21600000);
 const id='six-health:infrastructure:'+slot;
 await rest('agent_tasks',{
  id,goal:'Comprobar disponibilidad pública de Victoriosas',
  actor:'six-agent-safe-worker',action:'read_only_public_health',
  status:'queued',agent_id:'infrastructure',max_attempts:3,
  input:{kind:'public_site_health',slot}
 },'resolution=ignore-duplicates,return=minimal');
 const claims=await rest('rpc/six_agent_claim_public_health',{p_lease_seconds:90});
 if(!Array.isArray(claims))throw Error('invalid_claim_response');
 if(!claims.length)return {state:'no_eligible_task'};
 const claim=claims[0];
 if(typeof claim?.task_id!=='string'||!claim.task_id.startsWith('six-health:infrastructure:')||
    typeof claim?.claim_token!=='string')throw Error('unexpected_claim');
 let good=false;
 try{good=await publicSiteHealthy();}catch{good=false;}
 if(!good){
  await rest('rpc/six_agent_fail',{p_task_id:claim.task_id,p_token:claim.claim_token,p_reason:'site_unavailable'});
  throw Error('site_unavailable');
 }
 const completed=await rest('rpc/six_agent_complete',{
  p_task_id:claim.task_id,p_token:claim.claim_token,p_evidence:'site_http_200_brand_verified'
 });
 if(completed!==true)throw Error('fenced_completion_rejected');
 return {state:'completed',task_id:claim.task_id,evidence:'site_http_200_brand_verified'};
}
Deno.serve(async(request:Request)=>{
 if(request.method!=='POST')return respond(405,{error:'method_not_allowed'});
 const bearer=/^Bearer ([^ ]+)$/.exec(request.headers.get('authorization')??'');
 if(!bearer||bearer[1].length>8192)return respond(401,{error:'unauthorized'});
 try{
  const {payload}=await jwtVerify(bearer[1],JWKS,{issuer:ISSUER,audience:AUDIENCE,algorithms:['RS256']});
  if(payload.repository!=='Victoriosas/autopilot'||String(payload.repository_id)!=='1365196828'||
     payload.ref!=='refs/heads/main'||payload.workflow_ref!==WORKFLOW||
     !['schedule','workflow_dispatch'].includes(String(payload.event_name)))
     return respond(403,{error:'forbidden'});
 }catch{return respond(401,{error:'unauthorized'});}
 try{return respond(200,await work());}
 catch{return respond(503,{error:'safe_health_worker_failed'});}
});
