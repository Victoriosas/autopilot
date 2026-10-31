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
