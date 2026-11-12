import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp,mkdir,writeFile,readFile,stat,chmod,rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { createServer } from 'node:net';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as sleep } from 'node:timers/promises';
import { LocalMissionStore } from '../src/autopilot/localMissionStore';
import { cloudBinding,localCloudResources,type CloudMissionConfig } from '../src/autopilot/cloudMissionStore';
import { ManagedProcesses } from '../src/autopilot/managedProcesses';

const exec=promisify(execFile);
test('two isolated runner processes recover the same durable TLS ledger after real process death',
 {skip:process.env.CLOUD_LEDGER_FIXTURE!=='1',timeout:180000},async()=>{
 const root=await mkdtemp(path.join(tmpdir(),'cloud-ledger-fixture-'));
 const data=path.join(root,'pg');const children:ChildProcess[]=[];const processes=new ManagedProcesses();
 const binary=(name:string)=>path.join(process.env.PG_BIN||'',process.platform==='win32'?`${name}.exe`:name);
 const openssl=process.env.OPENSSL_PATH||'openssl';let started=false;
 const ca=path.join(root,'server.crt'),key=path.join(root,'server.key');
 const env=Object.fromEntries(['PATH','Path','SystemRoot','WINDIR','TEMP','TMP'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
 const freePort=()=>new Promise<number>((resolve,reject)=>{const s=createServer();s.on('error',reject);s.listen(0,'127.0.0.1',()=>{const p=(s.address() as {port:number}).port;s.close(()=>resolve(p));});});
 const port=await freePort();
 const sql=(query:string,user='postgres')=>new Promise<string>((resolve,reject)=>{
   const child=execFile(binary('psql'),['-h','127.0.0.1','-p',String(port),'-U',user,'-d','victoriosa_mission_operator_lab','-w','-X','-qAt','-v','ON_ERROR_STOP=1'],
     {env,windowsHide:true,timeout:15000},(error,out)=>error?reject(Error('fixture_sql_failed')):resolve(out.trim()));child.stdin!.end(query);
 });
 const cli=fileURLToPath(new URL('../scripts/autopilot-mission.ts',import.meta.url));
 type Event=Record<string,any>;
 function launch(command:string,config:string,args:string[]=[]){
   const child=spawn(process.execPath,['--import','tsx',cli,command,'--config',config,...args],{env:{...env,PSQL_PATH:binary('psql')},windowsHide:true,stdio:['ignore','pipe','pipe']});
   children.push(child);const events:Event[]=[];let buffer='';
   child.stdout!.on('data',b=>{buffer+=b;const lines=buffer.split(/\r?\n/);buffer=lines.pop()!;for(const l of lines)if(l.trim())events.push(JSON.parse(l));});
   child.stderr!.on('data',()=>{});const done=new Promise<number|null>(resolve=>child.on('close',resolve));return{child,events,done};
 }
 async function command(command:string,config:string,args:string[]=[],code=0){const r=launch(command,config,args);assert.equal(await r.done,code,JSON.stringify(r.events.at(-1)));return r.events.at(-1)!;}
 async function until<T>(read:()=>T|undefined|Promise<T|undefined>,timeout=20000):Promise<T>{const end=Date.now()+timeout;while(Date.now()<end){const value=await read();if(value!==undefined)return value;await sleep(50);}throw Error('fixture_observation_timeout');}
  async function effect(runner:ReturnType<typeof launch>,label:string){
    try {return await until(()=>{
      const found=runner.events.find(e=>e.event==='step_effect'&&e.stepId==='modify-v1');
      if(found)return found;
      if(runner.child.exitCode!==null||runner.child.signalCode!==null)throw Error('runner_closed_before_effect');
      return undefined;
    });}catch{
      // Fixed metadata fields only: never log mission payloads, SQL stderr or fencing tokens.
      const safe=(v:unknown)=>typeof v==='string'&&/^[a-z][a-z0-9_:-]{0,95}$/.test(v)?v:undefined;
      throw Error(`fixture_${label}_effect_failed: ${JSON.stringify({exit:runner.child.exitCode,
        events:runner.events.slice(-8).map(e=>({event:safe(e.event),code:safe(e.code),outcome:safe(e.outcome),reason:safe(e.reason),stepId:safe(e.stepId)}))})}`);
    }
  }
 try{
   await exec(binary('initdb'),['-D',data,'-U','postgres','-A','trust','--no-locale','--encoding=UTF8'],{env,windowsHide:true,timeout:30000});
   await exec(openssl,['req','-x509','-newkey','rsa:2048','-nodes','-keyout',key,'-out',ca,'-days','1','-subj','/CN=localhost','-addext','subjectAltName=IP:127.0.0.1,DNS:localhost'],{env,windowsHide:true,timeout:20000});
   await chmod(key,0o600);
   await writeFile(path.join(data,'pg_hba.conf'),'hostssl all autopilot_cloud_runner 127.0.0.1/32 scram-sha-256\nhost all autopilot_cloud_runner 127.0.0.1/32 reject\nhost all postgres 127.0.0.1/32 trust\n');
   const quote=(v:string)=>v.replaceAll('\\','/').replaceAll("'","''");
   await writeFile(path.join(data,'postgresql.auto.conf'),`listen_addresses='127.0.0.1'\nport=${port}\nunix_socket_directories='${quote(root)}'\nssl=on\nssl_cert_file='${quote(ca)}'\nssl_key_file='${quote(key)}'\npassword_encryption='scram-sha-256'\n`);
   try {
     await exec(binary('pg_ctl'),['-D',data,'-l',path.join(root,'postgres.log'),'-w','start'],{env,windowsHide:true,timeout:30000});started=true;
   } catch {
     // Only startup diagnostics from our empty disposable cluster, before role/password/admission setup.
     throw Error(`fixture_postgres_start_failed: ${(await readFile(path.join(root,'postgres.log'),'utf8')).slice(-3000)}`);
   }
   await exec(binary('createdb'),['-h','127.0.0.1','-p',String(port),'-U','postgres','victoriosa_mission_operator_lab'],{env,windowsHide:true,timeout:10000});
   const repo=path.join(root,'seed'),work=path.join(root,'work');await mkdir(repo);await mkdir(work);
   const git=(args:string[])=>exec('git',['-c','core.hooksPath=/dev/null',...args],{cwd:repo,env,windowsHide:true,timeout:10000});
   await git(['init']);await git(['config','user.name','Synthetic Fixture']);await git(['config','user.email','fixture@example.invalid']);
   await writeFile(path.join(repo,'synthetic-seed.txt'),'Autopilot disposable synthetic repository v1\n');await git(['add','.']);await git(['-c','commit.gpgsign=false','commit','-m','fixture']);
   const passFile=path.join(root,'runner.pgpass');
   await writeFile(passFile,`127.0.0.1:${port}:victoriosa_mission_operator_lab:autopilot_cloud_runner:disposable-fixture-only\n`,{mode:0o600});
   const c:CloudMissionConfig={version:1,mode:'cloud_synthetic_lab',ledgerId:'synthetic-cloud-recovery',
     database:{host:'127.0.0.1',port,name:'victoriosa_mission_operator_lab',user:'autopilot_cloud_runner',sslRootCert:ca,passFile},
     resources:{repository:repo,worktreeRoot:work,baseSha:(await git(['rev-parse','HEAD'])).stdout.trim()},
     permissions:{admit:false,execute:true,cancel:true},leaseSeconds:20,deadlineMs:18000,queryTimeoutMs:3000};
   const bootstrap={...localCloudResources(c),database:{...localCloudResources(c).database,user:'postgres'},permissions:{admit:true,execute:true,cancel:true}};
   const oldPsql=process.env.PSQL_PATH;process.env.PSQL_PATH=binary('psql');
   try {await new LocalMissionStore(bootstrap,processes).initialize();}finally{if(oldPsql===undefined)delete process.env.PSQL_PATH;else process.env.PSQL_PATH=oldPsql;}
   await sql(`update public.autopilot_local_lab set binding='${cloudBinding(c)}';create role autopilot_cloud_runner login password 'disposable-fixture-only';`);
   await sql(await readFile(new URL('../supabase/staged/cloud_synthetic_ledger_20261112.sql',import.meta.url),'utf8'));
   const a=path.join(root,'runner-a.json'),b=path.join(root,'runner-b.json');await writeFile(a,JSON.stringify(c));await writeFile(b,JSON.stringify(c));
   const id='synthetic-cloud-recover';const objective={version:1,kind:'synthetic.ensure_verified_artifact',expected:'canonical_synthetic_result',
     restrictions:['local_synthetic_only','no_network','no_send'],resources:['synthetic_worktree','result_artifact','verification_fixture'],
     acceptance:['artifact_matches','synthetic_test_passed'],limits:{maxReplans:1,maxSteps:8}};
   await sql(`set request.jwt.claim.role='service_role';select public.local_mission_admit('${id}','${JSON.stringify(objective)}'::jsonb,'${cloudBinding(c)}');`);
   // Gate only the post-effect checkpoint in this disposable database. No production failpoint exists.
   await sql(`create table public.fixture_gate(enabled boolean);insert into public.fixture_gate values(true);
     alter function public.six_agent_checkpoint(text,text,uuid,integer,text,text,jsonb) rename to fixture_checkpoint_core;
     create function public.six_agent_checkpoint(p_task_id text,p_mission_id text,p_token uuid,p_checkpoint_version integer,p_operation_id text,p_executor_id text,p_checkpoint jsonb)
     returns boolean language plpgsql security definer set search_path='' as $$begin
       if p_checkpoint->'completed_steps' ? 'modify-v1' then while(select enabled from public.fixture_gate) loop perform pg_sleep(0.05);end loop;end if;
       return public.fixture_checkpoint_core(p_task_id,p_mission_id,p_token,p_checkpoint_version,p_operation_id,p_executor_id,p_checkpoint);end$$;
     revoke all on function public.six_agent_checkpoint(text,text,uuid,integer,text,text,jsonb) from public;
     grant execute on function public.six_agent_checkpoint(text,text,uuid,integer,text,text,jsonb) to autopilot_cloud_runner;`);
   const runnerA=launch('resume',a,['--id',id]);
    await effect(runnerA,'runner_a');
   const status=async()=>(await command('status',b,['--id',id])).mission;
   const before=await status();assert.deepEqual(before.checkpoint.completed_steps,['prepare-v1']);
   assert.equal((await command('resume',b,['--id',id],3)).outcome,'busy');
   const token=await sql(`select execution_token from public.agent_tasks where id='${id}';`);
   const artifact=path.join(work,id,'.autopilot-synthetic','result.txt');const mtime=(await stat(artifact)).mtimeMs;
   runnerA.child.kill('SIGKILL');await runnerA.done;
   // The killed psql can no longer commit its checkpoint after its process dies/statement timeout.
   await until(async()=>await sql("select count(*) from pg_stat_activity where usename='autopilot_cloud_runner' and state='active';")==='0'?true:undefined);
   await sql('update public.fixture_gate set enabled=false;');
   await until(async()=>(await status()).leaseActive?undefined:true,25000);
   const interrupted=await status();assert.equal(interrupted.checkpointVersion,before.checkpointVersion);
   await sql('update public.fixture_gate set enabled=true;');
   const runnerB=launch('resume',b,['--id',id]);
    await effect(runnerB,'runner_b');
   const replacement=await status();assert.equal(replacement.attempts,2);assert.notEqual(replacement.runId,before.runId);
   assert.equal(await sql(`set request.jwt.claim.role='service_role';select public.six_agent_fail('${id}','${token}','stale_runner');`),'f');
   assert.equal(await sql(`set request.jwt.claim.role='service_role';select public.six_agent_checkpoint('${id}','${id}','${token}',${replacement.checkpointVersion+1},'stale-write','stale-runner','{}'::jsonb);`),'f');
   assert.equal(await sql(`set request.jwt.claim.role='service_role';select public.six_agent_complete('${id}','${token}','obsolete');`),'f');
   await sql('update public.fixture_gate set enabled=false;');assert.equal(await runnerB.done,0);
   const final=await status();
   assert.equal(final.state,'completed');assert.equal(final.attempts,2);assert.notEqual(final.runId,before.runId);
   assert.ok(final.checkpointVersion>before.checkpointVersion);assert.equal((await stat(artifact)).mtimeMs,mtime);
   assert.equal(final.audit.filter((e:Event)=>e.event==='mission_admitted').length,1);
   assert.equal((await command('resume',a,['--id',id])).outcome,'terminal');
   assert.equal((await status()).checkpointVersion,final.checkpointVersion);
   assert.equal(JSON.stringify([...runnerA.events,...runnerB.events,final]).includes(token),false,'token leaked into CLI output');
   const wrong=path.join(root,'wrong.json');await writeFile(wrong,JSON.stringify({...c,ledgerId:'synthetic-other-ledger'}));await command('status',wrong,['--id',id],2);
   await command('init',a,[],2);
   const missing=path.join(root,'missing.json');await writeFile(missing,JSON.stringify({...c,database:{...c.database,passFile:path.join(root,'absent')}}));await command('resume',missing,['--id',id],2);
   const badCA=path.join(root,'bad-ca');await writeFile(badCA,'invalid certificate');await writeFile(wrong,JSON.stringify({...c,database:{...c.database,sslRootCert:badCA}}));await command('status',wrong,['--id',id],2);
   // Least privilege verified with the actual runtime login, not only config assertions.
   const runnerEnv={...env,PGSSLMODE:'verify-full',PGSSLROOTCERT:ca,PGPASSFILE:passFile};
   const denied=async(q:string)=>assert.rejects(new Promise((resolve,reject)=>{const p=execFile(binary('psql'),['-h','127.0.0.1','-p',String(port),'-U','autopilot_cloud_runner','-d',c.database.name,'-w','-X','-qAt','-v','ON_ERROR_STOP=1'],{env:runnerEnv,windowsHide:true,timeout:10000},e=>e?reject(Error('denied')):resolve(true));p.stdin!.end(q);}));
   for(const q of ['create table public.forbidden(id int);','update public.agent_tasks set attempt_count=0;',
     `select public.local_mission_admit('synthetic-denied','{}','${cloudBinding(c)}');`, 'select public.six_agent_claim_mission(\'software\',20);'])await denied(q);
   console.log(JSON.stringify({case:'two_runner_tls_recovery',runners:2,attempts:final.attempts,state:final.state,
     checkpointPreserved:true,effectReconciled:true,staleWritesRejected:3,hostedDatabase:false,realCredentials:false}));
 }finally{
   for(const child of children)if(child.exitCode===null&&child.signalCode===null)child.kill('SIGKILL');
   await processes.close();if(started)await exec(binary('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{env,windowsHide:true,timeout:15000});
   assert.ok(root.startsWith(path.join(tmpdir(),'cloud-ledger-fixture-')));await rm(root,{recursive:true,force:true});
 }
});
