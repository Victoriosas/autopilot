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

async function getTasks():Promise<Record<string,unknown>[]> {
 const origin=Deno.env.get('SUPABASE_URL');
 const secret=key();
 if (!origin || !secret) throw Error('server_config_missing');
 const endpoint=new URL('/rest/v1/agent_tasks',origin);
 endpoint.searchParams.set('select','agent_id,status,updated_at,completed_evidence');
 endpoint.searchParams.set('order','updated_at.desc');
 endpoint.searchParams.set('limit','1000');
 const headers:Record<string,string>={apikey:secret,accept:'application/json'};
 if(secret.startsWith('eyJ')) headers.authorization='Bearer '+secret;
 const response=await fetch(endpoint,{headers,signal:AbortSignal.timeout(8000)});
 if(!response.ok) throw Error('data_api_unavailable');
 const rows=await response.json();
 if(!Array.isArray(rows) || rows.length>=1000) throw Error('report_not_exhaustive');
 return rows;
}
function report(rows:Record<string,unknown>[]) {
 return {
  generatedAt:new Date().toISOString(),
  observedRows:rows.length,
  unassigned:rows.filter(r=>!AGENTS.includes(r.agent_id as typeof AGENTS[number])).length,
  agents:AGENTS.map(agent=>{
   const a=rows.filter(row=>row.agent_id===agent);
   return {
    agent,
    queued:a.filter(r=>r.status==='queued').length,
    running:a.filter(r=>r.status==='running').length,
    failed:a.filter(r=>r.status==='failed').length,
    blocked:a.filter(r=>r.status==='blocked').length,
    completedWithEvidence:a.filter(r=>r.status==='completed' && typeof r.completed_evidence==='string' && r.completed_evidence.length>0).length,
    lastActivity:a.map(r=>r.updated_at).filter((v):v is string=>typeof v==='string').sort().at(-1) ?? null
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
 try{return respond(200,{state:'lectura verificada',report:report(await getTasks())});}
 catch{return respond(503,{error:'telemetry_unavailable'});}
});
