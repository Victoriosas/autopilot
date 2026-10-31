import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {digest,stateDirectory,summary} from '../lib/token-economy.mjs';

export function gitRead(project,args,{raw=false}={}) {
  const r=spawnSync('git',args,{cwd:project,encoding:'utf8',timeout:10000,windowsHide:true,maxBuffer:300000});
  if(r.status!==0)throw new Error('Cannot inspect the selected Git repository');
  return raw?r.stdout:r.stdout.trim();
}
export function fingerprint(project) {
  const commit=gitRead(project,['rev-parse','HEAD']);
  const names=gitRead(project,['ls-files','-m','-o','--exclude-standard','-z'],{raw:true}).split('\0').filter(Boolean);
  const changed=names.slice(0,1000).map(name=>{try{const s=fs.lstatSync(path.join(project,name));return [name,s.size,s.mtimeMs]}catch{return [name,'missing']}});
  return {commit,changedFiles:names.length,cacheEligible:names.length<=1000,value:digest(JSON.stringify([commit,changed,names.length]))};
}
export function status(project,{refresh=false,dir=path.join(os.homedir(),'.local/state/opencode-autopilot/control'),now=Date.now(),ttl=60000,health}={}) {
  fs.mkdirSync(dir,{recursive:true});const id=digest(path.resolve(project));const file=path.join(dir,id+'.json');
  const current=fingerprint(project);
  if(!refresh&&current.cacheEligible&&fs.existsSync(file)){
    const previous=JSON.parse(fs.readFileSync(file,'utf8'));
    if(previous.fingerprint===current.value&&now-previous.observedAtMs<ttl)return Promise.resolve({...previous,cacheHit:true,llmCalls:0});
  }
  return Promise.resolve(health?.()).then(gateway=>{
    const result={version:1,projectId:id,commit:current.commit,branch:gitRead(project,['branch','--show-current']),changedFiles:current.changedFiles,fingerprint:current.value,observedAtMs:now,observedAt:new Date(now).toISOString(),cacheHit:false,llmCalls:0,gatewayReachable:gateway??null};
    fs.writeFileSync(file,JSON.stringify(result,null,2),{mode:0o600});return result;
  });
}
export function tokenReport(dir=stateDirectory()) {
  if(!fs.existsSync(dir))return {sessions:0,usageSource:'not-reported',reported:null};
  const rows=fs.readdirSync(dir).filter(x=>x.endsWith('.json')).map(name=>summary(JSON.parse(fs.readFileSync(path.join(dir,name),'utf8'))));
  const observed=rows.filter(x=>x.reported);const totals={input:0,output:0,reasoning:0,cacheRead:0,cacheWrite:0};
  for(const row of observed)for(const key of Object.keys(totals))totals[key]+=row.reported[key];
  return {sessions:rows.length,observedSessions:observed.length,usageSource:observed.length?'opencode-reported':'not-reported',reported:observed.length?totals:null,hookCalls:rows.reduce((n,x)=>n+x.calls,0),omittedToolCharacters:rows.reduce((n,x)=>n+x.omittedChars,0),note:'Not billing. Sessions with no usage telemetry remain unknown; character reduction is not exact token savings.'};
}
export function missionPacket(objective,snapshot) {
  if(!objective||objective.length>2400)throw new Error('Supply one objective of 1-2400 characters');
  if(/(?:gsk_|gh[opusr]_|sk-or-v1-|csk-)[A-Za-z0-9_-]{20,}/.test(objective))throw new Error('Credential-like text is not allowed in a mission');
  return `Motor técnico del proyecto seleccionado: ejecuta una unidad verificable, aplicando TOKEN_POLICY.md y AGENTS.md. Usa evidencia vigente, no datos de clientas. Sin envíos, producción ni SQL alojado. No repitas revisiones ni pruebas aprobadas sin cambios. Al cerrar deja checkpoint <=1500 caracteres (objetivo, commit, archivos, prueba, bloqueo, siguiente acción). Estado determinista: ${JSON.stringify({commit:snapshot.commit,branch:snapshot.branch,changedFiles:snapshot.changedFiles})}. Objetivo del propietario: ${objective}`;
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const args=process.argv.slice(2);const command=args.shift()||'status';
  const i=args.indexOf('--project');const project=path.resolve(i>=0?args[i+1]:process.cwd());if(i>=0)args.splice(i,2);
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  if(command==='tokens'){console.log(JSON.stringify(tokenReport(),null,2));}
  else if(command==='status'){
    const result=await status(project,{refresh:args.includes('--refresh'),health:()=>fetch('http://127.0.0.1:3001/health',{signal:AbortSignal.timeout(2500)}).then(r=>r.ok).catch(()=>false)});
    console.log(JSON.stringify(result,null,2));
  } else if(command==='mission'){
    const objective=args.join(' ');const snapshot=await status(project);const prompt=missionPacket(objective,snapshot);
    const child=spawn(process.execPath,[path.join(root,'scripts/start.mjs'),'--project',project,'--agent','director','--prompt',prompt],{stdio:['ignore','inherit','inherit'],windowsHide:false});
    // One bounded execution; no unattended infinite loop and no scheduled task.
    const timer=setTimeout(()=>{if(process.platform==='win32')spawnSync('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true});else child.kill('SIGTERM');console.error('Mission time limit reached. Inspect changes and resume from checkpoint.');},12*60*1000);
    child.on('error',e=>{clearTimeout(timer);console.error(e.message);process.exitCode=1;});
    child.on('exit',code=>{clearTimeout(timer);process.exitCode=code??1;});
  }else throw new Error('Use status, tokens or mission; --project selects the repository');
}
