// Service endpoint for GitHub Actions. Only aggregated metrics leave Supabase.
// GitHub OIDC identity is verified cryptographically before privileged reads.
import {createRemoteJWKSet, jwtVerify} from 'npm:jose@5.9.6';

const ISSUER = 'https://token.actions.githubusercontent.com';
const JWKS = createRemoteJWKSet(new URL(ISSUER + '/.well-known/jwks'));
const AUDIENCE = 'victoriosas-six-agent-metrics';
const WORKFLOW = 'Victoriosas/autopilot/.github/workflows/six-agent-observability.yml@refs/heads/main';
const AGENTS = ['director','software','infrastructure','consultations','followup','reports'] as const;

const respond = (status:number, body:Record<string,unknown>) => new Response(JSON.stringify(body), {
 status, headers:{'content-type':'application/json; charset=utf-8','cache-control':'no-store','x-content-type-options':'nosniff'}
});

function key():string {
 const legacy=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 if (legacy) return legacy;
 const modern=Deno.env.get('SUPABASE_SECRET_KEYS');
 if (modern) {
   const parsed=JSON.parse(modern);
   if (typeof parsed.default==='string') return parsed.default;
 }
 return '';
}

async function getMetrics():Promise<Record<string,unknown>[]> {
 const origin=Deno.env.get('SUPABASE_URL');
 const secret=key();
 if (!origin || !secret) throw Error('server_config_missing');
 const endpoint=new URL('/rest/v1/rpc/six_agent_report_metrics',origin);
 const headers:Record<string,string>={apikey:secret,accept:'application/json','content-type':'application/json'};
 if(secret.startsWith('eyJ')) headers.authorization='Bearer '+secret;
 const response=await fetch(endpoint,{method:'POST',headers,body:'{}',signal:AbortSignal.timeout(8000)});
 if(!response.ok) throw Error('data_api_unavailable');
 const rows:unknown=await response.json();
 if(!Array.isArray(rows) || rows.length!==AGENTS.length) throw Error('report_invalid');
 return rows as Record<string,unknown>[];
}
function count(value:unknown):number {
 const parsed=Number(value);
 if(!Number.isSafeInteger(parsed) || parsed<0) throw Error('report_invalid');
 return parsed;
}
function report(rows:Record<string,unknown>[]) {
 const byAgent=new Map(rows.map(row=>[String(row.agent_id),row]));
 if(AGENTS.some(agent=>!byAgent.has(agent)) || byAgent.size!==AGENTS.length) throw Error('report_invalid');
 const first=rows[0];
 return {
  generatedAt:new Date().toISOString(),
  observedRows:count(first.observed_rows),
  unassigned:count(first.unassigned),
  agents:AGENTS.map(agent=>{
   const row=byAgent.get(agent)!;
   return {
    agent,
    queued:count(row.queued),
    running:count(row.running),
    failed:count(row.failed),
    blocked:count(row.blocked),
    completedWithEvidence:count(row.completed_with_evidence),
    lastActivity:typeof row.last_activity==='string' ? row.last_activity : null
   };
  })
 };
}
Deno.serve(async(request:Request):Promise<Response>=>{
 if(request.method!=='GET') return respond(405,{error:'method_not_allowed'});
 const bearer=/^Bearer ([^ ]+)$/.exec(request.headers.get('authorization')??'');
 if(!bearer || bearer[1].length>8192) return respond(401,{error:'unauthorized'});
 try{
  const {payload}=await jwtVerify(bearer[1],JWKS,{issuer:ISSUER,audience:AUDIENCE,algorithms:['RS256']});
  if(payload.repository!=='Victoriosas/autopilot' ||
     String(payload.repository_id)!=='1365196828' ||
     payload.ref!=='refs/heads/main' ||
     payload.workflow_ref!==WORKFLOW ||
     !['schedule','workflow_dispatch'].includes(String(payload.event_name))) {
    return respond(403,{error:'forbidden'});
  }
 }catch{return respond(401,{error:'unauthorized'});}
 try{return respond(200,{state:'lectura verificada',report:report(await getMetrics())});}
 catch{return respond(503,{error:'telemetry_unavailable'});}
});
