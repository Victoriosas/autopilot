import test from 'node:test';
import assert from 'node:assert/strict';
import { continuationDecision } from './missionContinuation';
import type { LocalMissionStatus } from './localMissionStore';
const state = (patch: Partial<LocalMissionStatus> = {}): LocalMissionStatus => ({
  id:'synthetic-resume',queueState:'running',state:'in_progress',reason:null,runId:'old',leaseActive:false,
  attempts:1,maxAttempts:3,checkpointVersion:2,planVersion:1,checkpoint:{completed_steps:['prepare']},plans:[],audit:[],...patch,
});
test('heartbeat skips live owners and terminal missions without starting executors', () => {
  assert.equal(continuationDecision(state({leaseActive:true})), 'busy');
  for (const status of ['completed','blocked','cancelled']) assert.equal(continuationDecision(state({state:status})), 'terminal');
});
test('expired claims and ready checkpoints recover through the same SQL claim without resetting progress', () => {
  const s = state(); const before = structuredClone(s);
  assert.equal(continuationDecision(s), 'resume'); assert.deepEqual(s,before);
  assert.equal(continuationDecision(state({state:'ready_to_complete'})), 'resume');
  assert.equal(continuationDecision(state({attempts:3})), 'resume');
  assert.throws(() => continuationDecision(state({queueState:'unknown'})), /invalid_continuation_state/);
});
