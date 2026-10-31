import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const freeMode=argv.includes('--free');
if(freeMode)argv.splice(argv.indexOf('--free'),1);
function take(name, fallback) {const i=argv.indexOf(name);if(i<0)return fallback;const v=argv[i+1];if(!v||v.startsWith('--'))throw new Error(`Missing value for ${name}`);argv.splice(i,2);return v;}
const project = path.resolve(take('--project',process.cwd()));
const selectedAgent = take('--agent','ingeniero');
const prompt = take('--prompt','');
if (!fs.existsSync(project)) throw new Error('Project directory does not exist');
const env = {...process.env};
if (!env.FREELLMAPI_API_KEY) {
  const r=spawnSync('powershell.exe',['-NoProfile','-Command',"[Environment]::GetEnvironmentVariable('FREELLMAPI_API_KEY','User')"],{encoding:'utf8',windowsHide:true});
  env.FREELLMAPI_API_KEY=r.stdout?.trim();
}
if (freeMode && !env.FREELLMAPI_API_KEY) throw new Error('Unified gateway credential not configured. Configure it locally; do not paste it into the chat.');
env.OPENCODE_WORKSTATION_HOME=root.replaceAll('\\','/');
env.OPENCODE_PROJECT_ROOT=project;
const origin=spawnSync('git',['remote','get-url','origin'],{cwd:project,encoding:'utf8',windowsHide:true}).stdout?.trim()||'';
const isVictoriosas=/(?:github\.com[:/])Victoriosas\/autopilot(?:\.git)?$/i.test(origin);
const profile=JSON.parse(fs.readFileSync(path.join(root,freeMode?'profiles/free.json':'profiles/global.json'),'utf8'));
if(freeMode)env.OPENCODE_COMPACT_TOOLS='1';else delete env.OPENCODE_COMPACT_TOOLS;
profile.instructions=[path.join(root,'REGLAS.md')];
if(isVictoriosas){
  const projectProfile=JSON.parse(fs.readFileSync(path.join(root,'profiles/victoriosas.json'),'utf8'));
  profile.agent={...profile.agent,...projectProfile.agent};
  profile.mcp={...profile.mcp,...projectProfile.mcp};
  profile.instructions.push(path.join(project,'AGENTS.md'),path.join(root,'VICTORIOSAS.md'));
  const local=path.join(project,'docs/OPENCODE_DIRECTIVES.md');
  if(fs.existsSync(local))profile.instructions.push(local);
  env.OPENCODE_CREDENTIAL_ROOT='C:/autopilot';
}else delete env.OPENCODE_CREDENTIAL_ROOT;
profile.default_agent=selectedAgent;
if(selectedAgent==='consulta')for(const server of Object.values(profile.mcp))server.enabled=false;
env.OPENCODE_CONFIG_CONTENT=JSON.stringify(profile);
let gateway=await fetch('http://127.0.0.1:3001/health',{signal:AbortSignal.timeout(2500)}).then(r=>r.ok).catch(()=>false);
if(!gateway){
  const lab='C:/freellmapi-lab';
  if(!fs.existsSync(path.join(lab,'server/dist/index.js')))throw new Error('Existing FreeLLMAPI installation not found');
  const logDir=path.join(os.homedir(),'.local/state/opencode-autopilot');fs.mkdirSync(logDir,{recursive:true});
  const log=fs.openSync(path.join(logDir,'gateway.log'),'a');
  const daemon=spawn(process.execPath,['server/dist/index.js'],{cwd:lab,env:{...env,HOST:'127.0.0.1',PORT:'3001'},stdio:['ignore',log,log],detached:true,windowsHide:true});daemon.unref();fs.closeSync(log);
  for(let i=0;i<10&&!gateway;i++){await new Promise(r=>setTimeout(r,1000));gateway=await fetch('http://127.0.0.1:3001/health',{signal:AbortSignal.timeout(1500)}).then(r=>r.ok).catch(()=>false);}
}
if(!gateway&&freeMode)throw new Error('FreeLLMAPI did not start. Review the local gateway log.');
if(!gateway)profile.mcp.freellmapi.enabled=false;
env.OPENCODE_CONFIG_CONTENT=JSON.stringify(profile);
const exe=path.join(env.APPDATA||path.join(os.homedir(),'AppData/Roaming'),'npm/node_modules/opencode-ai/bin/opencode.exe');
const args=prompt?['run','--agent',selectedAgent,prompt]:[];
const child=spawn(exe,args,{cwd:project,env,stdio:prompt?['ignore','inherit','inherit']:'inherit',windowsHide:false});
child.on('error',e=>{console.error(e.message);process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
