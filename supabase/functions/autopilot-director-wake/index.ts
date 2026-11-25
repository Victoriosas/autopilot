// Prepared for isolated preview. Not deployed.
// Deno runtime declarations limited to the two APIs this Edge entry uses;
// no external Deno typings needed in the Node/TypeScript build.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

import { createDirectorWakeHandler } from '../../../src/autopilot/directorWake.ts';
import { createCloudTrigger, createCloudBearerTrigger } from '../../../src/autopilot/cloudTrigger.ts';
import { cloudRpcClient } from '../../../src/autopilot/cloudRuntimeV3.ts';

// Replaced by the packaging command with the clean Git SHA, never from a request.
declare const __AUTOPILOT_ARTIFACT_SHA__: string;
declare const __AUTOPILOT_ISOLATED_API_KEY__: string;
const isolatedKey=typeof __AUTOPILOT_ISOLATED_API_KEY__==='string'?__AUTOPILOT_ISOLATED_API_KEY__:'';
const isolatedUrl='https://juyowvmtluxfetgkckjd.supabase.co';
const bearerTrigger=createCloudBearerTrigger({authenticate:async(jwt)=>{
 if(!isolatedKey)return false;
 const response=await fetch(isolatedUrl+'/auth/v1/user',{headers:{apikey:isolatedKey,authorization:'Bearer '+jwt},redirect:'error',signal:AbortSignal.timeout(8000)});
 if(!response.ok)return false;
 const user=await response.json();return user?.role==='autopilot_cloud_runtime';
},runtime:(jwt)=>({enabled:!!isolatedKey,
 reviewedSha:typeof __AUTOPILOT_ARTIFACT_SHA__==='string'?__AUTOPILOT_ARTIFACT_SHA__:'',
 artifactSha:typeof __AUTOPILOT_ARTIFACT_SHA__==='string'?__AUTOPILOT_ARTIFACT_SHA__:'',
 rpc:cloudRpcClient({url:isolatedUrl,apiKey:isolatedKey,jwt}),
})});
const trigger=createCloudTrigger({token:Deno.env.get('AUTOPILOT_CLOUD_TRIGGER_TOKEN'),runtime:()=>({
 enabled:Deno.env.get('AUTOPILOT_CLOUD_ENABLED')==='true'&&Deno.env.get('AUTOPILOT_SCHEDULER_OWNER')==='supabase_cron',
 reviewedSha:Deno.env.get('AUTOPILOT_CLOUD_REVIEWED_SHA')??'',
 artifactSha:typeof __AUTOPILOT_ARTIFACT_SHA__==='string'?__AUTOPILOT_ARTIFACT_SHA__:'unpackaged',
 rpc:cloudRpcClient({url:Deno.env.get('AUTOPILOT_CLOUD_LEDGER_URL')??'',
  apiKey:Deno.env.get('AUTOPILOT_CLOUD_API_KEY')??'',jwt:Deno.env.get('AUTOPILOT_CLOUD_RUNNER_JWT')??''}),
})});

const handler = createDirectorWakeHandler({
  token: Deno.env.get('AUTOPILOT_DIRECTOR_WAKE_TOKEN'),
});

Deno.serve(request=>{
 const path=new URL(request.url).pathname;
 return path.endsWith('/run-bearer')?bearerTrigger(request):path.endsWith('/run')?trigger(request):handler(request);
});
