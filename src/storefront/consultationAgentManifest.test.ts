import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import { buildConsultationAgentManifest, compareConsultationDefinitions } from './consultationAgentManifest';

test('checked-in manifest exactly reproduces canonical prompts and schemas', () => {
  assert.equal(readFileSync('docs/consultation-agents/camelrun-agent-manifest.json','utf8'),
    JSON.stringify(buildConsultationAgentManifest(), null, 2) + '\n');
});

test('snapshot drift rejects missing, duplicate, changed or unknown tool settings without leaking content', () => {
  const manifest=buildConsultationAgentManifest();
  const snapshot=manifest.definitions.map(v=>({id:v.definitionId,model:v.model,systemPrompt:v.systemPrompt,builtins:[],mcpServers:[]}));
  assert.ok(compareConsultationDefinitions(snapshot).every(v=>v.matches));
  for (const changed of [[],[...snapshot,snapshot[0]],snapshot.map(v=>({...v,systemPrompt:'private snapshot text'})),
    snapshot.map(v=>({...v,builtins:['web']})),snapshot.map(v=>({...v,mcpServers:undefined}))]) {
    const result=compareConsultationDefinitions(changed);
    assert.ok(result.some(v=>!v.matches));
    assert.ok(!JSON.stringify(result).includes('private snapshot text'));
  }
  assert.throws(()=>compareConsultationDefinitions({}),/SNAPSHOT_INVALID/);
  assert.equal(manifest.remoteApplyAuthorized,false);
  assert.equal(manifest.decision,'no_send');
});
