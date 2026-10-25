/** Read-only report, no external AI, notifications or customer information. */
import { appendFile } from 'node:fs/promises';
export const agents=Object.freeze(['director','software','infrastructure','consultations','followup','reports']);
export function summarize(rows,now=new Date()){
 if(!Array.isArray(rows))throw Error('invalid_rows');
 return {generatedAt:now.toISOString(),observedRows:rows.length,agents:agents.map(id=>{
  const group=rows.filter(r=>r.agent_id===id);
  return {agent:id,queued:group.filter(r=>r.status==='queued').length,
  running:group.filter(r=>r.status==='running').length,
  failed:group.filter(r=>r.status==='failed').length,
  blocked:group.filter(r=>r.status==='blocked').length,
  completedWithEvidence:group.filter(r=>r.status==='completed'&&!!r.completed_evidence).length,
  lastActivity:group.map(r=>r.updated_at).filter(Boolean).sort().at(-1)||null};
 })};
}
export function markdown(report,state){
 const table=report?.agents.map(a=>`| ${a.agent} | ${a.queued} | ${a.running} | ${a.failed} | ${a.blocked} | ${a.completedWithEvidence} | ${a.lastActivity||'sin registros'} |`).join('\n')||'';
 return `# Victoriosas | Informe diario de agentes\n\nEstado: **${state}**\n\nEl reporte se generó a las ${new Date().toISOString()} UTC. Horario objetivo: 19:00 Uruguay, sin garantía de puntualidad.\n\n${report?'| Agente | En espera | En curso | Fallida | Bloqueada | Completada con evidencia | Última actividad |\n|---|---:|---:|---:|---:|---:|---|\n'+table:'No se obtuvo telemetría. No se afirma que los agentes estén ejecutándose.'}\n\nNo certifica ejecución permanente ni envía mensajes.\n`;
}
export async function retrieveReport({url,key,fetcher=fetch,now=new Date()}){
 if(!url||!key)return {state:'sin credencial de lectura configurada',report:null};
 const endpoint=new URL('/rest/v1/agent_tasks',url);
 for(const [k,v] of Object.entries({select:'agent_id,status,updated_at,completed_evidence',agent_id:'not.is.null',order:'updated_at.desc',limit:'500'}))endpoint.searchParams.set(k,v);
 const response=await fetcher(endpoint,{method:'GET',headers:{apikey:key,Authorization:`Bearer ${key}`,Accept:'application/json'},signal:AbortSignal.timeout(9000)});
 if(!response.ok)return {state:`consulta rechazada HTTP ${response.status}`,report:null};
 const rows=await response.json();
 return {state:rows.length===500?'parcial (500 filas)':'lectura verificada',report:summarize(rows,now)};
}
async function main(){
 let outcome;
 try{outcome=await retrieveReport({url:process.env.SUPABASE_URL,key:process.env.SIX_AGENT_REPORT_READ_KEY});}
 catch{outcome={state:'sin telemetría por error de red o formato',report:null};}
 const content=markdown(outcome.report,outcome.state);
 if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,content);
 else process.stdout.write(content);
 if(!outcome.report)process.exitCode=1;
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)await main();
