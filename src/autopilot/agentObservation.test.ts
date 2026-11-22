import test from 'node:test';
import assert from 'node:assert/strict';
import { observeAgents, type AgentTaskObservation } from './agentObservation';

const now = new Date('2026-11-22T09:00:00Z');
const task = (overrides: Partial<AgentTaskObservation> = {}): AgentTaskObservation => ({
  id: 'synthetic-task', agent_id: 'director', status: 'running', attempt_count: 1,
  updated_at: '2026-11-22T08:59:30Z', lease_until: '2026-11-22T09:00:30Z',
  completed_evidence: null, ...overrides,
});

test('canonical configuration never proves a live executor, even with an owned lease', () => {
  const empty = observeAgents([], now);
  assert.equal(empty.length, 6);
  assert.deepEqual(empty.map(a => a.id), ['director','software','infrastructure','consultations','followup','reports']);
  assert.ok(empty.every(a => a.runtimeStatus === 'unknown' && a.measuredCostUsd === null));
  const director = observeAgents([task()], now)[0];
  assert.equal(director.running, 1);
  assert.equal(director.activityStatus, 'claimed');
  assert.equal(director.runtimeStatus, 'unknown');
});

test('expired, missing and malformed leases cannot count as running', () => {
  for (const lease_until of ['2026-11-22T08:59:59Z', now.toISOString(), null, 'invalid']) {
    const director = observeAgents([task({lease_until})], now)[0];
    assert.equal(director.running, 0);
    assert.equal(director.staleClaims, 1);
    assert.equal(director.activityStatus, 'reconciliation_required');
  }
  for (const updated_at of ['invalid', '2026-11-22T09:01:00Z']) {
    assert.equal(observeAgents([task({updated_at})], now)[0].running, 0);
  }
});

test('completed evidence is declared, not independently verified', () => {
  const director = observeAgents([
    task({id:'a',status:'completed',completed_evidence:'fixture declared evidence'}),
    task({id:'b',status:'completed',completed_evidence:'   '}),
    task({id:'c',status:'completed',completed_evidence:null}),
  ], now)[0];
  assert.equal(director.completed, 1);
  assert.equal(director.completionUnverified, 3);
  assert.equal(director.completionWithoutEvidence, 2);
  assert.equal(director.running, 0);
  assert.equal(director.activityStatus, 'recorded');
});

test('snapshot is order independent and exposes neither evidence nor task payloads', () => {
  const rows = [task({status:'queued',updated_at:'2026-11-22T08:00:00Z'}),
    task({id:'b',status:'blocked',completed_evidence:'private-sentinel'}),
    task({id:'c',agent_id:'unknown-role',status:'failed'}),
    task({id:'d',agent_id:'software',updated_at:'invalid'})];
  const snapshot = observeAgents(rows, now);
  assert.deepEqual(snapshot, observeAgents([...rows].reverse(), now));
  assert.equal(snapshot[0].lastActivity, '2026-11-22T08:59:30.000Z');
  assert.equal(snapshot[0].pending, 1);
  assert.equal(snapshot[0].blocked, 1);
  assert.equal(snapshot[1].lastActivity, null);
  assert.ok(!JSON.stringify(snapshot).includes('private-sentinel'));
  assert.throws(() => observeAgents(rows, new Date('invalid')), /invalid_observation_time/);
});
