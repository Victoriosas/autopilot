import test from 'node:test';
import assert from 'node:assert/strict';
import { POLICY, validateConfig, validateReply, buildEvidence, execute } from './bridge.mjs';

const agent = {
  key: POLICY.agent, model: 'anthropic/claude-haiku-5-5',
  spendLimit: { usd: 0.02, spent: 0 }, mounts: [], builtins: [], mcpServers: [],
  runLimits: { maxResponses: 2, maxSeconds: 90 }, toolSources: []
};
const pr = {
  number: 220, draft: true, state: 'open', merged: false,
  html_url: 'https://github.com/Victoriosas/autopilot/pull/220',
  head: { sha: POLICY.expectedHead }, base: { sha: 'base', repo: { full_name: POLICY.repository } }
};
const files = [{filename:'src/autopilot/nativeHost.ts'}, {filename:'tools/native-host/task.disabled.xml'}];
const reply = JSON.stringify({
  schema_version: '1.0', mode: 'READ_ONLY_DRY_RUN', verdict: 'INSUFFICIENT_EVIDENCE',
  observed: [], gaps: ['native unverified'], risks: [], proposed_next_steps: [],
  actions_executed: [], external_access: false
});
test('guard rejects write capable or unbudgeted agents', () => {
  assert.doesNotThrow(() => validateConfig(agent));
  assert.throws(() => validateConfig({...agent, mounts: [{path:'/workspace',mode:'rw'}]}), /mounts_present/);
  assert.throws(() => validateConfig({...agent, spendLimit: null}), /budget_missing/);
  assert.throws(() => validateConfig({...agent, mcpServers: [{}]}), /mcp_present/);
  assert.throws(() => validateConfig({...agent, toolSources:[{kind:'files',tools:[{name:'write'}]}]}), /writable_file_tools/);
});
test('strict JSON requires no external actions', () => {
  assert.equal(validateReply(reply).verdict, 'INSUFFICIENT_EVIDENCE');
  assert.throws(() => validateReply('\\`\\`\\`json\\n' + reply + '\\n\\`\\`\\`'));
  assert.throws(() => validateReply(JSON.stringify({...JSON.parse(reply),external_access:true})), /invalid_reply_contract/);
  assert.throws(() => validateReply(JSON.stringify({...JSON.parse(reply),actions_executed:['did something']})), /external_action_claim/);
});
test('PR must be exact approved SHA and remain draft', () => {
  assert.equal(buildEvidence(pr,files).changed_paths.length,2);
  assert.throws(() => buildEvidence({...pr,head:{sha:'changed'}},files), /head_moved/);
  assert.throws(() => buildEvidence({...pr,draft:false},files), /pr_state_changed/);
});
test('dry-run uses public GET only, no token nor writes', async () => {
  const calls = [];
  const mock = async (url,opts) => {
    calls.push([url,opts.method,opts.headers.authorization]);
    return {ok:true,json:async()=>url.includes('/files?')?files:pr};
  };
  const result = await execute({fetchImpl:mock});
  assert.equal(result.dispatched,false);
  assert.deepEqual(calls.map(c=>c[1]),['GET','GET']);
  assert.ok(calls.every(c=>!c[2]));
});
test('live refuses unsafe agent before POST', async () => {
  const calls=[];
  const mock = async (url,opts) => {
    calls.push(opts.method);
    const data=url.includes('/files?')?files:url.includes('/v1/agents/')?{...agent,mounts:[{path:'/workspace',mode:'rw'}]}:pr;
    return {ok:true,json:async()=>data};
  };
  await assert.rejects(execute({fetchImpl:mock,live:true,token:'dummy'}),/mounts_present/);
  assert.deepEqual(calls,['GET','GET','GET']);
});
test('live uses bounded prompt and validates result', async () => {
  const calls=[];
  const mock = async (url,opts) => {
    calls.push({url,opts});
    const data = url.includes('/files?') ? files : url.includes('/v1/agents/') ?
      (opts.method==='POST' ? {status:'completed',text:reply} : agent) : pr;
    return {ok:true,json:async()=>data};
  };
  const r=await execute({fetchImpl:mock,live:true,token:'dummy'});
  assert.equal(r.verified,true);
  const write=calls.find(c=>c.opts.method==='POST');
  assert.equal(new URL(write.url).host,'run.camelai.com');
  assert.equal(JSON.parse(write.opts.body).spendLimit.usd,0.003);
  assert.equal(calls.filter(c=>c.opts.method==='POST').length,1);
});
