import test from 'node:test';
import assert from 'node:assert/strict';
import { inspectShadowRun } from './shadowInspector';
import { diagnoseShadowItems } from './shadowDiagnostics';

test('diagnosis counts products per blocker without counting stale successful checkpoints', () => {
  const result = diagnoseShadowItems([
    { status: 'needs_evidence', reasons: ['MARKET_EVIDENCE_INSUFFICIENT', 'MARKET_EVIDENCE_INSUFFICIENT'] },
    { status: 'needs_evidence', reasons: ['MARKET_EVIDENCE_INSUFFICIENT', 'SHIPPING_EVIDENCE_REQUIRED'] },
    { status: 'shadow_completed', reasons: ['MARKET_EVIDENCE_INSUFFICIENT'] },
    { status: 'normalized' },
  ]);
  assert.equal(result.totalItems, 4);
  assert.equal(result.successfulItems, 1);
  assert.equal(result.blockedItems, 2);
  assert.equal(result.pendingItems, 1);
  assert.equal(result.blockers[0].code, 'MARKET_EVIDENCE_INSUFFICIENT');
  assert.equal(result.blockers[0].itemCount, 2);
  assert.match(result.nextAction, /comparables/);
});

test('missing or malformed reasons remain visible without invented explanations', () => {
  const result = diagnoseShadowItems([
    { status: 'council_rejected', reasons: [null, 9, ''] },
    { status: 'failed_retryable', reasons: 'not-an-array' },
  ]);
  assert.equal(result.blockedItems, 2);
  assert.deepEqual(result.blockers.map(b => b.code), ['STATUS:council_rejected', 'STATUS:failed_retryable']);
  assert.equal(diagnoseShadowItems([]).totalItems, 0);
  assert.match(diagnoseShadowItems([]).nextAction, /No hay productos/);
  assert.match(diagnoseShadowItems([{ status: 'shadow_completed' }]).nextAction, /no autoriza publicar/);
});

function databaseFixture(selected: any, queryError: any = null) {
  const reads: Array<{ table: string; filters: unknown[] }> = [];
  const recent = Array.from({ length: 10 }, (_, i) => ({ id: `recent-${i}` }));
  const db = { from(table: string) {
    const read = { table, filters: [] as unknown[] };
    reads.push(read);
    const builder = {
      select() { return builder; },
      eq(key: string, value: string) { read.filters.push([key, value]); return builder; },
      order() { return builder; },
      limit() { return Promise.resolve({ data: recent, error: null }); },
      maybeSingle() { return Promise.resolve({ data: selected, error: queryError }); },
      then(resolve: any, reject: any) { return Promise.resolve({ data: [], error: null }).then(resolve, reject); },
    };
    return builder;
  } };
  return { db: db as any, reads };
}

test('explicit run ID retrieves history beyond the ten recent runs', async () => {
  const { db, reads } = databaseFixture({ id: 'older-run', status: 'completed_no_candidates' });
  const result = await inspectShadowRun('older-run', db);
  assert.equal(result.run.id, 'older-run');
  assert.equal(result.runs.length, 10);
  assert.deepEqual(reads[1].filters, [['id', 'older-run']]);
  assert.deepEqual(reads[2].filters, [['run_id', 'older-run']]);
  assert.equal(result.diagnostics.totalItems, 0);
});

test('unknown run ID never falls back to an unrelated recent run', async () => {
  const { db, reads } = databaseFixture(null);
  const result = await inspectShadowRun('missing', db);
  assert.equal(result.run, null);
  assert.deepEqual(result.items, []);
  assert.equal(reads.length, 2);
});

test('run query errors propagate instead of reporting an empty successful inspection', async () => {
  const { db } = databaseFixture(null, new Error('database unavailable'));
  await assert.rejects(inspectShadowRun('older-run', db), /database unavailable/);
});

test('default inspection still selects the latest run', async () => {
  const { db, reads } = databaseFixture(null);
  const result = await inspectShadowRun(undefined, db);
  assert.equal(result.run.id, 'recent-0');
  assert.deepEqual(reads[1].filters, [['run_id', 'recent-0']]);
});
