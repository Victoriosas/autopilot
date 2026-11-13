import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { cloudBinding } from '../src/autopilot/cloudMissionStore.ts';
import { isolatedHostEnvironment,prepareHostedHost } from './hosted-ledger-host.mjs';

// Invoked only by the manual, protected job. No provisioning/admission path.
const exec=promisify(execFile);
let root;
try {
 const {GITHUB_ACTIONS,GITHUB_SHA,P0C_REVIEWED_SHA,P0C_RUNNER_PASSWORD,P0C_CA_CERT,P0C_MISSION_ID,P0C_ACTION}=process.env;
 if(GITHUB_ACTIONS!=='true' || !/^[a-f0-9]{40}$/.test(GITHUB_SHA||'') || P0C_REVIEWED_SHA!==GITHUB_SHA
   || !['status','resume'].includes(P0C_ACTION) || !/^synthetic-[a-z0-9-]{1,60}$/.test(P0C_MISSION_ID||'')
   || !P0C_RUNNER_PASSWORD || /[\r\n\0]/.test(P0C_RUNNER_PASSWORD) || !P0C_CA_CERT) throw Error('configuration_required');
 root=await mkdtemp(path.join(tmpdir(),'p0c-runner-'));
 // Deliberately excludes secrets, injected Git/Node/PG options and author configuration.
 const env=isolatedHostEnvironment();
 const config=await prepareHostedHost(root);const {database}=config;
 await writeFile(database.sslRootCert,P0C_CA_CERT,{mode:0o600});
 const escaped=P0C_RUNNER_PASSWORD.replaceAll('\\','\\\\').replaceAll(':','\\:');
 await writeFile(database.passFile,`${database.host}:5432:postgres:autopilot_cloud_runner:${escaped}\n`,{mode:0o600});
 const file=path.join(root,'host.json');await writeFile(file,JSON.stringify(config),{mode:0o600});
 // Only sanitized outcome metadata is published, never config, SQL stderr, task data or audit.
 console.log(JSON.stringify({event:'hosted_runner_configured',binding:cloudBinding(config),baseSha:config.resources.baseSha}));
 const result=await exec(process.execPath,['--import','tsx','scripts/autopilot-mission.ts',P0C_ACTION,'--config',file,'--id',P0C_MISSION_ID],
   {env,cwd:process.cwd(),windowsHide:true,timeout:45000,maxBuffer:1024*1024});
 const last=JSON.parse(result.stdout.trim().split(/\r?\n/).at(-1));
 console.log(JSON.stringify({event:'hosted_runner_finished',action:P0C_ACTION,completed:true,
   state:['queued','running','completed','blocked','failed','cancelled'].includes(last.mission?.state)?last.mission.state:undefined}));
} catch { console.error('hosted_runner_blocked_or_failed');process.exitCode=2; }
finally {if(root)await rm(root,{recursive:true,force:true});}
