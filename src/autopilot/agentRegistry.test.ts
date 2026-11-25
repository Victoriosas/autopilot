import assert from 'node:assert/strict';
import test from 'node:test';
import { AGENT_IDS } from './sixAgentControlPlane';
import { getAgent, listAgents } from './agentRegistry';
import type { AutopilotAction } from './policyEngine';

test('the API registry describes exactly the six Autopilot roles', () => {
  const agents = listAgents();
  assert.deepEqual(agents.map(({ id }) => id).sort(), [...AGENT_IDS].sort());
  assert.equal(new Set(agents.map(({ id }) => id)).size, AGENT_IDS.length);
});

test('the initial configuration cannot imply a deployed or active worker', () => {
  for (const agent of listAgents()) {
    assert.equal(agent.enabled, false, agent.id);
    assert.equal(agent.runtimeStatus, 'not_proven', agent.id);
    assert.equal(agent.noSend, true, agent.id);
  }
});

test('director is read-only and code, deployment, secrets, purchase, and publication stay gated', () => {
  const director = getAgent('director');
  assert.ok(director);
  assert.deepEqual(director.autonomousActions, ['read', 'analyze']);
  const gatedActions: AutopilotAction[] = ['write_code', 'create_branch', 'merge_main', 'deploy_production', 'modify_secrets', 'purchase', 'refund', 'publish_product'];
  for (const action of gatedActions) {
    assert.ok(director.humanGatedActions.includes(action), action);
  }
});

test('registry results are defensive copies', () => {
  const first = listAgents();
  first[0].autonomousActions.splice(0);
  first[0].humanGatedActions.splice(0);
  assert.notDeepEqual(listAgents()[0].autonomousActions, []);
  assert.notDeepEqual(listAgents()[0].humanGatedActions, []);
});
