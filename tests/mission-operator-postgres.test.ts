import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const database=process.env.OPERATOR_TEST_DATABASE_URL;
const exec=promisify(execFile);
test('standalone operator CLI proves admission execution supervision cancellation and persistent relaunch',
  {skip:!database,timeout:180000},async()=>{
    const url=new URL(database!);assert.equal(url.hostname,'127.0.0.1');assert.equal(url.pathname,'/victoriosa_mission_operator_lab');assert.equal(url.search,'');
    const root=await mkdtemp(path.join(tmpdir(),'autopilot-operator-cli-'));const repo=path.join(root,'seed');const worktrees=path.join(root,'worktrees');
    await mkdir(repo);await mkdir(worktrees);
    const git=(args:string[])=>exec('git',['-c','core.hooksPath=/dev/null',...args],{cwd:repo,windowsHide:true,timeout:10000});
    await git(['init']);await git(['config','user.name','Synthetic Autopilot']);await git(['config','user.email','synthetic@example.invalid']);
    await writeFile(path.join(repo,'synthetic-seed.txt'),'Autopilot disposable synthetic repository v1\n');await git(['add','synthetic-seed.txt']);
    await git(['-c','commit.gpgsign=false','commit','-m','synthetic seed']);
    const config=path.join(root,'host.json');const output=path.join(root,'evidence.json');
    await writeFile(config,JSON.stringify({version:1,mode:'local_synthetic_lab',database:{host:'127.0.0.1',port:Number(url.port||5432),name:'victoriosa_mission_operator_lab',user:decodeURIComponent(url.username)},
      resources:{repository:repo,worktreeRoot:worktrees,baseSha:(await git(['rev-parse','HEAD'])).stdout.trim()},permissions:{admit:true,execute:true,cancel:true},
      leaseSeconds:10,deadlineMs:8000,queryTimeoutMs:3000}));
    const env={...process.env,PGPASSWORD:decodeURIComponent(url.password),NODE_TEST_CONTEXT:undefined};
    const runSql=(query:string)=>new Promise<string>((resolve,reject)=>{
      const child=execFile(process.env.PSQL_PATH||'psql',['-h','127.0.0.1','-p',url.port||'5432','-U',decodeURIComponent(url.username),'-d','victoriosa_mission_operator_lab','-w','-X','-qAt','-v','ON_ERROR_STOP=1'],
        {env,windowsHide:true,timeout:10000},(error,out)=>error?reject(Error('synthetic_setup_failed')):resolve(out.trim()));child.stdin!.end(query);
    });
    await runSql('create schema private_sentinel;create table private_sentinel.synthetic_guard(id integer);');
    await assert.rejects(exec(process.execPath,['--import','tsx',fileURLToPath(new URL('../scripts/autopilot-mission.ts',import.meta.url)),'init','--config',config],{env,windowsHide:true,timeout:20000}),
      'initialization must reject existing non-public data');
    assert.equal(await runSql("select coalesce(to_regclass('public.autopilot_local_lab')::text,'absent');"),'absent');
    await runSql('drop table private_sentinel.synthetic_guard;drop schema private_sentinel;');
    await exec(process.execPath,['--import','tsx',fileURLToPath(new URL('../scripts/autopilot-mission.ts',import.meta.url)),'init','--config',config],{env,windowsHide:true,timeout:20000});
    const result=await exec(process.execPath,['--import','tsx',fileURLToPath(new URL('../scripts/demo-local-missions.ts',import.meta.url)),config,output],
      {env,windowsHide:true,timeout:140000,maxBuffer:65536});
    const evidence=JSON.parse(await readFile(output,'utf8'));assert.equal(evidence.cases.length,6);assert.equal(evidence.unattendedStart,false);
    assert.equal(evidence.cases[1].effectsReconciled,true);assert.equal(evidence.cases[3].childTerminated,true);assert.equal(evidence.cases[4].childTerminated,true);
    console.log(result.stdout.trim());
    // Manual invocation of the real host entry in the existing disposable lab; NOT a native trigger.
    const checkout=fileURLToPath(new URL('../',import.meta.url));
    const native=JSON.parse(await readFile(new URL('../tools/native-host/mission-request.json',import.meta.url),'utf8'));
    const request=path.join(root,'native-request.json');await writeFile(request,JSON.stringify(native));
    await exec(process.execPath,['--import','tsx',fileURLToPath(new URL('../scripts/autopilot-mission.ts',import.meta.url)),'admit','--config',config,'--request',request],{env,timeout:15000});
    const execution=path.join(root,'execution.json');await writeFile(execution,JSON.stringify({...JSON.parse(await readFile(config,'utf8')),permissions:{admit:false,execute:true,cancel:false}}));
    const evidenceDir=path.join(root,'native-evidence');await mkdir(evidenceDir);
    const locate=process.platform==='win32'?'where.exe':'which';
    const gitFile=(await exec(locate,['git'])).stdout.trim().split(/\r?\n/)[0];
    const psqlFile=process.env.PSQL_PATH||(await exec(locate,['psql'])).stdout.trim().split(/\r?\n/)[0];
    const sha=(await exec('git',['rev-parse','HEAD'],{cwd:checkout})).stdout.trim();
    const descriptor={version:1,checkout,approvedSha:sha,executionConfig:execution,configSha256:createHash('sha256').update(await readFile(execution)).digest('hex'),
      evidenceDirectory:evidenceDir,missionId:native.id,taskName:'\\Victoriosas-Autopilot-Synthetic-Demo',node:process.execPath,git:gitFile,psql:psqlFile,maxDurationMs:45000};
    const descriptorFile=path.join(root,'native.json');await writeFile(descriptorFile,JSON.stringify(descriptor));
    const entry=fileURLToPath(new URL('../scripts/autopilot-native-host.ts',import.meta.url));
    const launch=()=>exec(process.execPath,['--import','tsx',entry,'--manifest',descriptorFile,'--manual'],{env,timeout:50000,maxBuffer:65536});
    const compete=async()=>{try{return await launch();}catch(error){if((error as any).code===3)return {stdout:(error as any).stdout};throw error;}};
    const pair=await Promise.all([compete(),compete()]);
    const launches=pair.map(r=>r.stdout.trim().split(/\r?\n/).map((x:string)=>JSON.parse(x)));
    assert.equal(launches.flat().filter(x=>x.event==='claimed').length,1,'only one launcher may claim');
    const rows=launches.find(events=>events.some(x=>x.event==='claimed'))!;
    assert.equal(rows.find(x=>x.event==='host_started').origin.mode,'manual');
    assert.equal(rows.at(-1).outcome,'completed');assert.match(rows.at(-1).runId,/^[a-f0-9-]{36}$/);
    assert.ok(rows.some(x=>x.event==='process_started'&&x.operation==='cli_run'&&x.pid));
    assert.equal(JSON.parse((await launch()).stdout.trim().split(/\r?\n/).at(-1)!).outcome,'terminal');
    await writeFile(descriptorFile,JSON.stringify({...descriptor,configSha256:'0'.repeat(64)}));
    await assert.rejects(launch());
    console.log('native host manual launcher: competing processes claimed once, completed, terminal replay and tampered configuration denied; no scheduler registered');
  });
