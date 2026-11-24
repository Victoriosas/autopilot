import {createDirectorWakeHandler} from './directorWake.ts';
import {runCloudOffice,type CloudRuntimeConfig} from './cloudRuntimeV3.ts';

/** Separate cloud execution token; the legacy preflight token cannot execute. */
export function createCloudTrigger(config:{token?:string;runtime:()=>CloudRuntimeConfig}) {
 const authenticate=createDirectorWakeHandler({token:config.token});
 return async(request:Request)=>{
  const path=new URL(request.url).pathname;
  if(!['/functions/v1/autopilot-director-wake/run','/autopilot-director-wake/run'].includes(path))return Response.json({error:'not_found'},{status:404});
  if(request.method!=='POST')return Response.json({error:'method_not_allowed'},{status:405});
  const auth=await authenticate(new Request('https://internal.invalid/autopilot-director-wake',{
   method:'POST',headers:{'x-autopilot-wake-token':request.headers.get('x-autopilot-cloud-token')??''}
  }));
  if(auth.status!==200)return auth;
  try{return Response.json(await runCloudOffice(config.runtime()),{headers:{'cache-control':'no-store'}});}
  catch{return Response.json({error:'cloud_runtime_unavailable'},{status:503,headers:{'cache-control':'no-store'}});}
 };
}
