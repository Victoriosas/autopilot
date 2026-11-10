/** Standalone demonstration driver, not a test runner or runtime dependency. Faults only; no plans/repairs/checkpoints. */
import assert from 'node:assert/strict';
import { spawn, type ChildProcess } from 'node:child_process';
import { writeFile, stat, mkdtemp, mkdir, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { readLocalConfig, localProcessEnvironment } from '../src/autopilot/localMissionConfig';
import { ManagedProcesses } from '../src/autopilot/managedProcesses';

const configFile=process.argv[2]; const outputFile=process.argv[3];
if (!configFile || !outputFile || process.argv.length!==4) throw Error('usage_demo_CONFIG_OUTPUT');
const config=await readLocalConfig(configFile);
const folder=await mkdtemp(path.join(tmpdir(),'autopilot-operator-demo-'));
const hostFile=path.join(folder,'host.json');
await writeFile(hostFile,JSON.stringify({...config,queryTimeoutMs:5000}));
const cli=fileURLToPath(new URL('./autopilot-mission.ts',import.meta.url));
const rawProcesses=new ManagedProcesses(); const children: ChildProcess[]=[];
type Event=Record<string,any>;
function launch(command: string, args: string[]=[], host=hostFile) {
  const child=spawn(process.execPath,['--import','tsx',cli,command,'--config',host,...args],{windowsHide:true,stdio:['ignore','pipe','pipe']});
  children.push(child); const events: Event[]=[]; let buffer='';
  child.stdout!.on('data',data=>{buffer+=data;const lines=buffer.split(/\r?\n/);buffer=lines.pop()!;for(const line of lines)if(line.trim())events.push(JSON.parse(line));});
  child.stderr!.on('data',()=>{});
  const done=new Promise<number|null>(resolve=>child.on('close',resolve));
  return {child,events,done};
}
async function command(command: string,args: string[]=[],codes=[0],host=hostFile) {
  const run=launch(command,args,host); const code=await run.done;
  assert.ok(codes.includes(code!),`CLI ${command} rejected: ${JSON.stringify(run.events.at(-1))}`); return run.events;
}
async function until<T>(get:()=>Promise<T|undefined>|T|undefined,ms=20000):Promise<T>{
  const deadline=Date.now()+ms;
  while(Date.now()<deadline){const value=await get();if(value!==undefined)return value;await sleep(50);}throw Error('demo_observation_timeout');
}
const find=(run:ReturnType<typeof launch>,predicate:(e:Event)=>boolean)=>until(()=>run.events.find(predicate));
const status=async(id:string)=>(await command('status',['--id',id])).at(-1)!.mission;
const objective={version:1,kind:'synthetic.ensure_verified_artifact',expected:'canonical_synthetic_result',restrictions:['local_synthetic_only','no_network','no_send'],
  resources:['synthetic_worktree','result_artifact','verification_fixture'],acceptance:['artifact_matches','synthetic_test_passed'],limits:{maxReplans:1,maxSteps:8}};
const suffix=randomUUID().slice(0,8); const evidence:Event={entry:'scripts/autopilot-mission.ts',manualStart:true,unattendedStart:false,cases:[]};
async function request(label:string,extra:object={}){
  const id=`synthetic-cli-${label}-${suffix}`;const file=path.join(folder,`${label}.json`);await writeFile(file,JSON.stringify({id,objective,...extra}));return {id,file};
}
async function sql(query:string){
  const d=config.database;
  return (await rawProcesses.exec(process.env.PSQL_PATH||'psql',['-h',d.host,'-p',String(d.port),'-U',d.user,'-d',d.name,'-w','-X','-qAt','-v','ON_ERROR_STOP=1'],
    {env:localProcessEnvironment(),input:`set statement_timeout=10000;set request.jwt.claim.role='service_role';\n${query}`,timeout:12000,operation:'demo_fault_injection'})).stdout.trim();
}
let gateInstalled=false;
async function installGate(){
  await sql(`create table public.local_demo_gate(enabled boolean);insert into public.local_demo_gate values(true);
    alter function public.six_agent_checkpoint(text,text,uuid,integer,text,text,jsonb) rename to local_demo_checkpoint_core;
    create function public.six_agent_checkpoint(p_task_id text,p_mission_id text,p_token uuid,p_checkpoint_version integer,p_operation_id text,p_executor_id text,p_checkpoint jsonb)
    returns boolean language plpgsql security definer set search_path='' as $$ begin
      if p_checkpoint->'completed_steps' ? 'modify-v1' then
        while (select enabled from public.local_demo_gate) loop perform pg_sleep(0.05); end loop;
      end if;
      return public.local_demo_checkpoint_core(p_task_id,p_mission_id,p_token,p_checkpoint_version,p_operation_id,p_executor_id,p_checkpoint);
    end $$;
    revoke all on function public.six_agent_checkpoint(text,text,uuid,integer,text,text,jsonb) from public,anon,authenticated;
    grant execute on function public.six_agent_checkpoint(text,text,uuid,integer,text,text,jsonb) to service_role;`);
  gateInstalled=true;
}
const gate=async(enabled:boolean)=>sql(`update public.local_demo_gate set enabled=${enabled};`);
async function restoreGate(){if(!gateInstalled)return;await gate(false);await sql(`drop function public.six_agent_checkpoint(text,text,uuid,integer,text,text,jsonb);
  alter function public.local_demo_checkpoint_core(text,text,uuid,integer,text,text,jsonb) rename to six_agent_checkpoint;drop table public.local_demo_gate;`);gateInstalled=false;}
async function waitingEffect(run:ReturnType<typeof launch>){
  await find(run,e=>e.event==='step_effect'&&e.stepId==='modify-v1');
  return find(run,e=>e.event==='process_started'&&e.operation==='six_agent_checkpoint'&&run.events.slice(0,run.events.indexOf(e)).some(p=>p.event==='step_effect'&&p.stepId==='modify-v1'));
}
async function assertGone(pid:number){await until(()=>{try{process.kill(pid,0);return undefined;}catch{return true;}},7000);}
try {
  // Admission, duplicate, rejection and a complete manual execution: all through separate CLI processes.
  const normal=await request('normal');
  const admissions=await Promise.all([command('admit',['--request',normal.file]),command('admit',['--request',normal.file])]);
  assert.deepEqual(admissions.map(events=>events.at(-1)!.state).sort(),['duplicate','queued']);
  assert.equal((await command('admit',['--request',normal.file])).at(-1)!.state,'duplicate');
  const rejected=await request('reject',{objective:{...objective,kind:'send_email'}});
  assert.equal((await command('admit',['--request',rejected.file],[2])).at(-1)!.code,'objective_not_admitted');
  await command('status',['--id',rejected.id],[2]);
  const normalEvents=await command('run',['--id',normal.id]); const normalState=await status(normal.id);
  assert.equal(normalState.state,'completed');assert.equal(normalState.audit.filter((e:Event)=>e.event==='mission_admitted').length,1);
  assert.equal(normalEvents.at(-1)!.childrenRemaining,0);
  const conflict=path.join(folder,'conflicting-admission.json');await writeFile(conflict,JSON.stringify({id:normal.id,objective:{...objective,limits:{maxReplans:0,maxSteps:8}}}));
  assert.equal((await command('admit',['--request',conflict],[2])).at(-1)!.code,'admission_conflict');
  evidence.cases.push({case:'manual_admission_and_execution',mission:normalState,duplicateAdmission:'duplicate',rejectedObjective:'not_queued'});
  await installGate();
  // Actual executor loss after filesystem effects, before a checkpoint can commit. No checkpoint is supplied by this driver.
  const recovery=await request('recover');await command('admit',['--request',recovery.file]);
  const old=launch('run',['--id',recovery.id]);const oldChild=await waitingEffect(old);
  const progress=await status(recovery.id);assert.equal(progress.queueState,'running');assert.deepEqual(progress.checkpoint.completed_steps,['prepare-v1']);
  const oldToken=await sql(`select execution_token from public.agent_tasks where id='${recovery.id}';`);
  const files=['result.txt','result.test.cjs'].map(name=>path.join(config.resources.worktreeRoot,recovery.id,'.autopilot-synthetic',name));
  const before=await Promise.all(files.map(file=>stat(file)));
  old.child.kill('SIGKILL');await old.done;
  await assertGone(oldChild.pid); // Orphan psql is bounded by server statement_timeout even after an uncatchable parent death.
  await until(async()=>{const s=await status(recovery.id);return s.leaseActive?undefined:true;},config.leaseSeconds*1000+5000);
  assert.equal(await sql(`select public.six_agent_fail('${recovery.id}','${oldToken}','obsolete_executor');`),'f');
  const replacement=launch('run',['--id',recovery.id]);await waitingEffect(replacement);
  const resumed=await status(recovery.id);assert.equal(resumed.queueState,'running');assert.notEqual(resumed.runId,progress.runId);assert.equal(resumed.attempts,2);
  assert.equal(await sql(`select public.six_agent_fail('${recovery.id}','${oldToken}','obsolete_executor');`),'f');
  await gate(false);assert.equal(await replacement.done,0);
  const recovered=await status(recovery.id);assert.equal(recovered.state,'completed');assert.equal(recovered.checkpoint.results[1].summary,'synthetic_effect_reconciled');
  for(let i=0;i<files.length;i++)assert.equal((await stat(files[i])).mtimeMs,before[i].mtimeMs);
  assert.equal(JSON.stringify([...old.events,...replacement.events,recovered]).includes(oldToken),false,'fencing token leaked through entry');
  evidence.cases.push({case:'real_process_loss_and_manual_relaunch',before:progress,mission:recovered,leaseExpiry:'natural',staleWritesRejected:true,effectsReconciled:true});
  // Two execution processes compete while the owner is held at an injected SQL boundary.
  await gate(true);const competed=await request('compete');await command('admit',['--request',competed.file]);
  const owner=launch('run',['--id',competed.id]);await waitingEffect(owner);
  const contender=await command('run',['--id',competed.id],[3]);assert.equal(contender.at(-1)!.outcome,'busy');
  await gate(false);assert.equal(await owner.done,0);const competedState=await status(competed.id);assert.equal(competedState.attempts,1);
  evidence.cases.push({case:'two_competing_executors',contender:'busy',mission:competedState});
  // Durable cancellation from another process must also terminate the owner's currently running child.
  await gate(true);const cancelled=await request('cancel');await command('admit',['--request',cancelled.file]);
  const active=launch('run',['--id',cancelled.id]);const activeChild=await waitingEffect(active);
  await command('cancel',['--id',cancelled.id]);assert.equal(await active.done,0);await assertGone(activeChild.pid);
  const cancelledState=await status(cancelled.id);assert.equal(cancelledState.state,'cancelled');assert.equal(active.events.at(-1)!.childrenRemaining,0);
  assert.equal((await command('cancel',['--id',cancelled.id])).at(-1)!.changed,false);
  assert.equal((await command('admit',['--request',cancelled.file])).at(-1)!.state,'duplicate');
  await command('run',['--id',cancelled.id]);assert.equal((await status(cancelled.id)).attempts,1);
  evidence.cases.push({case:'durable_cancellation',childTerminated:true,mission:cancelledState});await gate(false);
  // Host timeout kills the same operational entry's processes and records a retryable reason.
  const timed=await request('timeout');await command('admit',['--request',timed.file]);await gate(true);
  const timedHost=path.join(folder,'timed-host.json');await writeFile(timedHost,JSON.stringify({...config,queryTimeoutMs:5000,deadlineMs:4000}));
  const timeoutRun=launch('run',['--id',timed.id],timedHost);const timeoutChild=await waitingEffect(timeoutRun);
  assert.equal(await timeoutRun.done,2);await assertGone(timeoutChild.pid);
  const timedState=await status(timed.id);assert.equal(timedState.reason,'run_timeout');assert.equal(timedState.queueState,'failed');
  assert.equal(timeoutRun.events.at(-1)!.childrenRemaining,0);evidence.cases.push({case:'host_timeout',childTerminated:true,mission:timedState});
  await gate(false);
  // Host privilege and destination cannot be overridden by the request.
  const badHost=path.join(folder,'bad-host.json');await writeFile(badHost,JSON.stringify({...config,database:{...config.database,host:'example.invalid'}}));
  assert.equal((await command('status',['--id',normal.id],[2],badHost)).at(-1)!.code,'unauthorized_local_config');
  const deniedHost=path.join(folder,'denied-host.json');await writeFile(deniedHost,JSON.stringify({...config,permissions:{admit:false,execute:false,cancel:false}}));
  await command('run',['--id',normal.id],[2],deniedHost);await command('cancel',['--id',normal.id],[2],deniedHost);
  const injected=await request('injected',{plan:['shell:arbitrary'],database:{host:'example.invalid'}});
  assert.equal((await command('admit',['--request',injected.file],[2])).at(-1)!.code,'invalid_admission_request');
  const unboundRoot=path.join(folder,'unbound-worktrees');await mkdir(unboundRoot);
  const unboundHost=path.join(folder,'unbound-host.json');await writeFile(unboundHost,JSON.stringify({...config,resources:{...config.resources,worktreeRoot:unboundRoot}}));
  await command('status',['--id',normal.id],[2],unboundHost);assert.deepEqual(await readdir(unboundRoot),[]);
  evidence.cases.push({case:'host_and_payload_boundaries',unauthorizedDestination:'rejected_before_connection',payloadEscalation:'rejected',hostPermissionDenial:'rejected'});
  await restoreGate();
  await writeFile(outputFile,JSON.stringify(evidence,null,2));console.log(JSON.stringify({event:'demonstration_completed',cases:evidence.cases.length,output:outputFile,manual:true,unattended:false}));
} finally {
  for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
  if(gateInstalled)await restoreGate();await rawProcesses.close();
}
