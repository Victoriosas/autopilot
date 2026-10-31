import assert from 'node:assert/strict';
import fs from 'node:fs';
import { enableCamelRunReadOnly } from '../lib/remote-read-profile.mjs';
const fixture = () => JSON.parse(fs.readFileSync(new URL('../profiles/global.json', import.meta.url), 'utf8'));
for (const options of [{isVictoriosas:false,agent:'operaciones'},{isVictoriosas:true,agent:'ingeniero'}]) {
  const profile=fixture(), before=JSON.stringify(profile);
  assert.throws(()=>enableCamelRunReadOnly(profile,options));
  assert.equal(JSON.stringify(profile),before);
}
const profile=enableCamelRunReadOnly(fixture(),{isVictoriosas:true,agent:'operaciones'});
assert.equal(profile.mcp.camelrun.enabled,true);
assert.equal(profile.mcp.resend.enabled,false);
assert.equal(profile.permission['camelrun_*'],'deny');
assert.equal(profile.permission.camelrun_list_agents,'allow');
assert.ok(Object.keys(profile.permission).indexOf('camelrun_list_agents')>Object.keys(profile.permission).indexOf('camelrun_*'));
for(const [name,agent] of Object.entries(profile.agent)){
  assert.equal(agent.tools['camelrun_*'],false);
  assert.equal(agent.tools.camelrun_list_agents,name==='operaciones'?true:undefined);
}
assert.equal(profile.agent.operaciones.tools.camelrun_run_agent,undefined);
console.log('PASS: scoped on-demand camelRun inventory, other roles and Resend remain blocked');

const { enableResendReadOnly } = await import('../lib/remote-read-profile.mjs');
for (const options of [{isVictoriosas:false,agent:'operaciones'},{isVictoriosas:true,agent:'ingeniero'}]) {
  const profile=fixture(), before=JSON.stringify(profile);
  assert.throws(()=>enableResendReadOnly(profile,options));
  assert.equal(JSON.stringify(profile),before);
}
const resend=enableResendReadOnly(fixture(),{isVictoriosas:true,agent:'operaciones'});
assert.equal(resend.mcp.resend.enabled,true);
assert.equal(resend.mcp.camelrun.enabled,false);
assert.equal(resend.permission['resend_*'],'deny');
assert.equal(resend.permission['resend_list-domains'],'allow');
assert.ok(Object.keys(resend.permission).indexOf('resend_list-domains')>Object.keys(resend.permission).indexOf('resend_*'));
assert.equal(resend.agent.operaciones.tools['resend_list-domains'],true);
assert.equal(resend.agent.ingeniero.tools['resend_list-domains'],undefined);
assert.equal(resend.agent.operaciones.tools.resend_send_email,undefined);
console.log('PASS: scoped on-demand Resend domains, sending and mutations blocked');
