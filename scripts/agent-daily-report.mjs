/** GitHub OIDC-backed aggregated report. No database key or client information. */
import {appendFile} from 'node:fs/promises';
export const agents=Object.freeze(['director','software','infrastructure','consultations','followup','reports']);
export function validReport(value) {
 if (!value || typeof value !== 'object' || !Number.isSafeInteger(value.observedRows) || value.observedRows<0 || !Array.isArray(value.agents) || value.agents.length!==6) return false;
 return agents.every(agent=>{
  const a=value.agents.find(x=>x?.agent===agent);
  return a && ['queued','running','failed','blocked','completedWithEvidence'].every(k=>Number.isSafeInteger(a[k]) && a[k]>=0)
    && (a.lastActivity===null || (typeof a.lastActivity==='string' && /^\d{4}-\d\d-\d\dT/.test(a.lastActivity)));
 });
}
export function markdown(report,state){
 const table=report?.agents.map(a=>`| ${a.agent} | ${a.queued} | ${a.running} | ${a.failed} | ${a.blocked} | ${a.completedWithEvidence} | ${a.lastActivity||'sin registros'} |`).join('\n')||'';
 return `# Victoriosas | Informe diario de agentes\n\nEstado: **${state}**\n\nEl reporte se generó a las ${new Date().toISOString()} UTC. Horario objetivo: 19:00 Uruguay, sin garantía de puntualidad.\n\n${report?'Tareas observadas: '+report.observedRows+'. Sin agente asignado o rol desconocido: '+(report.unassigned??'no informado')+'.\n\n| Agente | En espera | En curso | Fallida | Bloqueada | Completada con evidencia | Última actividad |\n|---|---:|---:|---:|---:|---:|---|\n'+table:'No se obtuvo telemetría verificada. No se puede acreditar actividad real de agentes.'}\n\nNo certifica ejecución permanente ni envía mensajes.\n`;
}
export async function requestGitHubOIDC({url=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,fetcher=fetch}={}){
 if(!url||!token)throw Error('oidc_unavailable');
 const endpoint=new URL(url);
 if(endpoint.protocol!=='https:')throw Error('oidc_url_insecure');
 endpoint.searchParams.set('audience','victoriosas-six-agent-metrics');
 const r=await fetcher(endpoint,{headers:{Authorization:`Bearer ${token}`},signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('oidc_request_failed');
 const data=await r.json();
 if(typeof data?.value!=='string'||!data.value)throw Error('oidc_token_missing');
 return data.value;
}
export async function retrieveReport({url=process.env.SUPABASE_URL,fetcher=fetch,tokenProvider=requestGitHubOIDC}={}){
 if(!url) return {state:'endpoint no configurado',report:null};
 try {
  const endpoint=new URL('/functions/v1/six-agent-report-metrics',url);
  if(endpoint.protocol!=='https:')throw Error('endpoint_insecure');
  const token=await tokenProvider();
  const res=await fetcher(endpoint,{method:'GET',headers:{authorization:`Bearer ${token}`,accept:'application/json'},signal:AbortSignal.timeout(10000)});
  if(!res.ok)return {state:`lectura rechazada HTTP ${res.status}`,report:null};
  const data=await res.json();
  if(data.state!=='lectura verificada'||!validReport(data.report))throw Error('invalid_report');
  return {state:'lectura verificada (GitHub OIDC)',report:data.report};
 }catch{return {state:'telemetría no verificable',report:null};}
}
async function main(){
 const result=await retrieveReport();
 const output=markdown(result.report,result.state);
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,output);
 else process.stdout.write(output);
 if(!result.report)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)await main();
