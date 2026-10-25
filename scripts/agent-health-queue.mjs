/** Request one fixed public-health queue execution using short-lived GitHub OIDC. */
import {appendFile} from 'node:fs/promises';
const AUD='victoriosas-six-agent-health';
export async function requestToken({url=process.env.ACTIONS_ID_TOKEN_REQUEST_URL,token=process.env.ACTIONS_ID_TOKEN_REQUEST_TOKEN,fetcher=fetch}={}){
 if(!url||!token)throw Error('oidc_not_available');
 const u=new URL(url);if(u.protocol!=='https:')throw Error('oidc_url_insecure');
 u.searchParams.set('audience',AUD);
 const r=await fetcher(u,{headers:{authorization:'Bearer '+token},signal:AbortSignal.timeout(9000)});
 if(!r.ok)throw Error('oidc_failure');
 const payload=await r.json();if(typeof payload?.value!=='string'||!payload.value)throw Error('oidc_missing');
 return payload.value;
}
export async function runHealth({url='https://jfjzpwlrhzqbcrvqxhzf.supabase.co',fetcher=fetch,tokenProvider=requestToken}={}){
 const base=new URL(url);
 if(base.protocol!=='https:'||base.hostname!=='jfjzpwlrhzqbcrvqxhzf.supabase.co')throw Error('unapproved_supabase_project');
 const token=await tokenProvider();
 const res=await fetcher(new URL('/functions/v1/six-agent-health-worker',base),{
  method:'POST',headers:{authorization:'Bearer '+token,accept:'application/json'},signal:AbortSignal.timeout(30000)
 });
 if(!res.ok)throw Error('worker_http_'+res.status);
 const data=await res.json();
 if(data?.state==='no_eligible_task')return {state:'no_eligible_task'};
 if(data?.state!=='completed'||!String(data.task_id).startsWith('six-health:infrastructure:')||
    data.evidence!=='site_http_200_brand_verified')throw Error('worker_result_unverified');
 return {state:'completed'};
}
async function main(){
 try {
  const r=await runHealth();
  const summary='# Victoriosas | Cola infraestructura\n\n'+
   (r.state==='completed'?'Tarea de salud completada con evidencia y auditoría en Supabase.':'Sin tarea elegible; no se acredita una nueva ejecución.')+'\n';
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
  else process.stdout.write(summary);
 }catch(e){
  const summary='# Victoriosas | Cola infraestructura\n\nEjecución fallida o no verificable. Consultar registros protegidos de Supabase.\n';
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,summary);
  else process.stderr.write(summary);
  process.exitCode=1;
 }
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)await main();
