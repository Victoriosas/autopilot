/** Low-cost public availability check; never inspects customer data. */
import {appendFile} from 'node:fs/promises';
export const PUBLIC_URL='https://victoriosas.online/';
export async function checkSite({fetcher=fetch,url=PUBLIC_URL}={}){
 const u=new URL(url);
 if (u.protocol!=='https:' || u.hostname!=='victoriosas.online' || u.pathname!=='/') throw Error('unapproved_target');
 const r=await fetcher(u,{method:'GET',redirect:'manual',headers:{accept:'text/html'},signal:AbortSignal.timeout(12000)});
 if(!r.ok) throw Error('http_'+r.status);
 const body=await r.text();
 if(!body.includes('Victoriosas'))throw Error('brand_not_found');
 return {checkedAt:new Date().toISOString(),status:r.status,verifiedBrand:true};
}
export function summary(result){
 return '# Victoriosas | Auditor de infraestructura\n\nSitio: https://victoriosas.online/\n\nHTTP: '+result.status+'\nMarca encontrada: '+(result.verifiedBrand?'sí':'no')+'\nObservado (UTC): '+result.checkedAt+'\n\nLa prueba es una comprobación pública de disponibilidad, no evidencia de actividad de los otros agentes.\n';
}
async function main(){
 try{
  const output=summary(await checkSite());
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,output);
  else process.stdout.write(output);
 }catch(e){
  const code=e instanceof Error&&/^(http_\d+|brand_not_found|unapproved_target)$/.test(e.message)?e.message:'network_or_timeout';
  const output='# Victoriosas | Auditor de infraestructura\n\nEstado: FALLO ('+code+')\n';
  if(process.env.GITHUB_STEP_SUMMARY)await appendFile(process.env.GITHUB_STEP_SUMMARY,output);
  else process.stderr.write(output);
  process.exitCode=1;
 }
}
if(process.argv[1]&&import.meta.url===new URL(`file://${process.argv[1]}`).href)await main();
