// Prepared for isolated preview. Not deployed.
// Deno runtime declarations limited to the two APIs this Edge entry uses;
// no external Deno typings needed in the Node/TypeScript build.
declare const Deno: {
  env: { get(name: string): string | undefined };
  serve(handler: (request: Request) => Promise<Response>): unknown;
};

import { createDirectorWakeHandler } from '../../../src/autopilot/directorWake.ts';
import { createCloudTrigger } from '../../../src/autopilot/cloudTrigger.ts';
import { cloudRpcClient } from '../../../src/autopilot/cloudRuntimeV3.ts';

// Replaced by the packaging command with the clean Git SHA, never from a request.
declare const __AUTOPILOT_ARTIFACT_SHA__: string;
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

Deno.serve(request=>new URL(request.url).pathname.endsWith('/run')?trigger(request):handler(request));
