import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';

export const DEFAULTS = Object.freeze({calls:16,delegations:3,reportedVolume:90000,readLines:160,outputChars:8000,taskPromptChars:6000});
export const responseCap = agent => ({consulta:256,director:768,revisor:1024,seguridad:1024,datos:1200,operaciones:768,qa:1024,documentacion:1536}[agent] || 1536);
export const digest = value => crypto.createHash('sha256').update(String(value)).digest('hex').slice(0,24);
export const finite = v => Number.isFinite(v) && v >= 0 ? v : 0;
export function clipOutput(value, limit=DEFAULTS.outputChars) {
  if(typeof value!=='string'||value.length<=limit)return {text:value,omitted:0};
  const head=Math.floor(limit*0.6),tail=limit-head;
  return {text:value.slice(0,head)+`\n[OUTPUT SHORTENED: ${value.length-limit} characters omitted. Errors may be in the retained tail. Request a narrower range to inspect omitted content.]\n`+value.slice(-tail),omitted:value.length-limit};
}
export function usageFrom(info) {
  if(info?.role!=='assistant'||!info.time?.completed||!info.tokens)return null;
  const t=info.tokens;
  return {input:finite(t.input),output:finite(t.output),reasoning:finite(t.reasoning),cacheRead:finite(t.cache?.read),cacheWrite:finite(t.cache?.write),total:Number.isFinite(t.total)?t.total:null};
}
export function volume(u) { return u.total ?? u.input+u.output+u.cacheRead+u.cacheWrite; }
export function stateDirectory() {return process.env.OPENCODE_ECONOMY_STATE || path.join(os.homedir(),'.local/state/opencode-autopilot/economy');}
export function createStore(dir=stateDirectory()) {
  fs.mkdirSync(dir,{recursive:true});
  function filename(session) {return path.join(dir,digest(session)+'.json');}
  function read(session) {
    const file=filename(session);
    if(!fs.existsSync(file))return {version:1,calls:0,delegations:0,omittedChars:0,messages:{},updatedAt:null};
    // A corrupt accounting file is an explicit error, never an invented zero.
    return JSON.parse(fs.readFileSync(file,'utf8'));
  }
  function write(session,change) {
    const state=read(session);change(state);state.updatedAt=new Date().toISOString();
    const file=filename(session),tmp=file+'.tmp-'+crypto.randomUUID();
    fs.writeFileSync(tmp,JSON.stringify(state),{mode:0o600});fs.renameSync(tmp,file);return state;
  }
  return {read,write};
}
export function summary(state) {
  const rows=Object.values(state.messages);const sums={input:0,output:0,reasoning:0,cacheRead:0,cacheWrite:0};
  for(const row of rows)for(const key of Object.keys(sums))sums[key]+=finite(row[key]);
  return {calls:state.calls,delegations:state.delegations,omittedChars:state.omittedChars,observedMessages:rows.length,reported:rows.length?sums:null,conservativeVolume:rows.reduce((n,u)=>n+volume(u),0),usageSource:rows.length?'opencode-reported':'not-reported',updatedAt:state.updatedAt};
}
export function registerUsage(store,info) {
  const usage=usageFrom(info);if(!usage||!info.sessionID||!info.id)return;
  return store.write(info.sessionID,s=>{s.messages[digest(info.id)]=usage;});
}
export function reserveCall(store,session,limits=DEFAULTS) {
  return store.write(session,s=>{
    if(s.calls>=limits.calls||summary(s).conservativeVolume>=limits.reportedVolume)throw new Error('TOKEN_BUDGET_REACHED: stop this cycle, preserve evidence and resume from the checkpoint in a new bounded task.');
    s.calls++;
  });
}
export function reserveDelegation(store,session,limits=DEFAULTS) {
  return store.write(session,s=>{if(s.delegations>=limits.delegations)throw new Error('DELEGATION_BUDGET_REACHED: use existing findings; no recursive committees. Save a checkpoint.');s.delegations++;});
}
