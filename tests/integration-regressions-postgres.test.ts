// Run only through the disposable SCRAM harness. All child suites get local URLs.
import test from 'node:test';
import {execFile} from 'node:child_process';
import {readFile,writeFile,mkdtemp,unlink} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {labConnection,sql} from './fixtures/directorSupervisionLab';
const base=labConnection();
const run=(args:string[],env:NodeJS.ProcessEnv)=>new Promise<void>((resolve,reject)=>{
 const childEnv={...env};delete childEnv.NODE_TEST_CONTEXT;
 const child=execFile(process.execPath,args,{env:childEnv,windowsHide:true,timeout:260000,maxBuffer:1048576},(error,stdout,stderr)=>{
  process.stdout.write(stdout);process.stderr.write(stderr);
  error||/run\(\) is being called recursively/.test(stderr)||!/tests [1-9][0-9]*/.test(stdout)?reject(Error('isolated_regression_failed')):resolve();
 });
});
test('remaining CI PostgreSQL regressions on a fresh local SCRAM cluster',{timeout:800000},async t=>{
 const cases=[
  ['sourcing and shadow','autopilot_orchestrator_test','AUTOPILOT_TEST_DATABASE_URL',['sourcing-postgres.test.ts','shadow-auth-postgres.test.ts']],
  ['mission runner','victoriosa_mission_runner_test','MISSION_TEST_DATABASE_URL',['mission-runner-postgres.test.ts']],
  ['mission planner','victoriosa_mission_planner_test','PLANNER_TEST_DATABASE_URL',['mission-planner-postgres.test.ts']],
  ['mission operator','victoriosa_mission_operator_lab','OPERATOR_TEST_DATABASE_URL',['mission-operator-postgres.test.ts']],
  ['consultation material','victoriosa_material_test','MATERIAL_TEST_DATABASE_URL',['consultation-material-postgres.test.ts']],
 ] as const;
 const selected=process.env.INTEGRATION_REGRESSION_CASE;
 if(selected&&!cases.some(([name])=>name===selected))throw Error('unknown_regression_case');
 for(const [name,database,variable,files] of cases.filter(([name])=>!selected||name===selected))await t.test(name,async()=>{
  await sql('create database '+database+';');
  const target=new URL(base);target.pathname='/'+database;if(variable!=='OPERATOR_TEST_DATABASE_URL')target.password='';
  for(const file of files)await run(['--import','tsx','--test','tests/'+file],{...process.env,[variable]:target.href});
 });
 if(!selected)await t.test('queue fencing and process-loss recovery',async()=>{
  const database='victoriosa_six_agent_test';await sql('create database '+database+';');
  const target=new URL(base);target.pathname='/'+database;target.password='';
  const scratch=await mkdtemp(path.join(tmpdir(),'queue-shell-test-'));
  const script=path.join(scratch,'queue.sh');
  await writeFile(script,(await readFile('scripts/test-six-agent-queue.sh','utf8')).replaceAll('\r\n','\n'));
  try {await new Promise<void>((resolve,reject)=>{
   execFile(process.platform==='win32'?'C:/Program Files/Git/bin/bash.exe':'bash',[script.replaceAll('\\','/')],
    {env:{...process.env,AUTOPILOT_TEST_DATABASE_URL:target.href},windowsHide:true,timeout:60000,maxBuffer:1048576},
    (error,stdout,stderr)=>{process.stdout.write(stdout);process.stderr.write(stderr);error?reject(Error('queue_shell_test_failed')):resolve();});
  });}finally{await unlink(script);}
  await run(['--test','tests/six-agent-recovery.test.mjs'],{...process.env,AUTOPILOT_TEST_DATABASE_URL:target.href});
 });
});
