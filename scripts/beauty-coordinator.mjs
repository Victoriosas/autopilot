// Bounded local coordinator. It never schedules itself or deploys/migrates.
import { spawn } from 'node:child_process';
import { mkdir,open,writeFile,readFile,unlink } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
const root=process.cwd();
const directory=path.join(root,'.audit','beauty-coordinator');await mkdir(directory,{recursive:true});
const lock=path.join(directory,'active.lock');
const tasks=[
 {id:'beauty-contracts',objective:'Validate commercial intake and privacy contracts',agent:'Codex tests',args:['--import','tsx','--test','src/storefront/beautyRequests.test.ts','src/storefront/beautyRouter.test.ts','src/storefront/beautyFrontend.test.ts','src/storefront/beautyCatalogFrontend.test.ts','src/storefront/beautyManagement.test.ts','src/storefront/beautyManagementRouter.test.ts']},
 {id:'beauty-catalog-postgres',objective:'Validate private evaluation and managed catalog in disposable PostgreSQL',agent:'Codex database',args:['scripts/test-beauty-catalog-postgres.mjs']},
 {id:'beauty-postgres',objective:'Validate disposable PostgreSQL and HTTP persistence',agent:'Codex database',args:['scripts/test-beauty-postgres.mjs']},
];
const inputs=['src/storefront/beautyManagement.ts','src/storefront/beautyManagementRouter.ts','src/storefront/beautyDatabase.ts','supabase/migrations/20261017230000_beauty_catalog_evaluations.sql','src/storefront/beautyRequests.ts','src/storefront/beautyRouter.ts','src/storefront/beautyRequests.test.ts','src/storefront/beautyRouter.test.ts','src/storefront/beautyFrontend.test.ts','src/security/adminAuth.ts','public/beauty-services.js','tests/beauty-postgres.test.ts','scripts/test-beauty-postgres.mjs','supabase/migrations/20261017220000_beauty_requests.sql','supabase/migrations/20261017221000_beauty_retention.sql'];
const digest=createHash('sha256');for(const file of inputs){digest.update(file);digest.update(await readFile(path.join(root,file)));}const revision=digest.digest('hex');
const args=process.argv.slice(2);
if(args.some(a=>!['--run-next','--status'].includes(a))){console.error('Use --status or --run-next (one task per invocation)');process.exit(2);}
if(!args.includes('--run-next')){console.log(JSON.stringify({mode:'read-only',tasks:tasks.map(({args,...t})=>t),next:'Run one allowlisted check with --run-next. No automatic scheduling.'},null,2));process.exit(0);}
let handle;try{handle=await open(lock,'wx');await handle.writeFile(JSON.stringify({pid:process.pid,startedAt:new Date().toISOString()}));}catch{console.error('Coordinator already locked. Review the previous process before removing its lock.');process.exit(3);}
const stateFile=path.join(directory,'state.json');
try{
 let state={completed:[],revision};try{state=JSON.parse(await readFile(stateFile,'utf8'));}catch{}
 if(state.revision!==revision)state={completed:[],revision};
 const task=tasks.find(t=>!state.completed.includes(t.id));
 if(!task){console.log('Bounded queue complete; no pending safe task.');process.exitCode=0;}
 else{
  const began=new Date().toISOString();
  const child=spawn(process.execPath,task.args,{cwd:root,windowsHide:true,stdio:'inherit'});
  let timeout=false;const timer=setTimeout(()=>{timeout=true;child.kill();},120000);
  const code=await new Promise(resolve=>{child.once('error',()=>resolve(1));child.once('exit',c=>resolve(c??1));});clearTimeout(timer);
  if(code===0&&!timeout)state.completed.push(task.id);
  const evidence={id:task.id,objective:task.objective,agent:task.agent,status:code===0&&!timeout?'verified':'blocked',began,ended:new Date().toISOString(),exitCode:code,timeout,changes:'No application changes by coordinator',tests:task.args,next:tasks.find(t=>!state.completed.includes(t.id))?.id||'Review deployment and hosted migration approval',blockers:code===0?[]:['Inspect test failure; no automatic retry']};
  await writeFile(path.join(directory,task.id+'.json'),JSON.stringify(evidence,null,2));await writeFile(stateFile,JSON.stringify(state,null,2));console.log(JSON.stringify(evidence));process.exitCode=Number(code);
 }
}finally{await handle.close();await unlink(lock);}
