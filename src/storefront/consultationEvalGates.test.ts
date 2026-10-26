import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, readFileSync, existsSync, unlinkSync, rmdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { developmentGatePassed, hasEvaluationCoverage, validateEvalFile } from './consultationAgentEval';

const file = validateEvalFile(JSON.parse(readFileSync('docs/consultation-agents/eval-cases-v1.json', 'utf8')));
const development = file.cases.filter(c => c.split === 'desarrollo').map(c => ({ id: c.id, pass: true }));
const controls = file.guardian_controls.map(c => ({ id: c.id, pass: true }));

test('final gate requires every distinct development case and guardian control to pass', () => {
  assert.equal(developmentGatePassed(file, development, controls), true);
  for (const [cases, checks] of [
    [[], []], [development.slice(1), controls], [development, controls.slice(1)],
    [[...development.slice(1), development[1]], controls],
    [development.map((r, i) => i ? r : { ...r, pass: false }), controls],
    [development, controls.map((r, i) => i ? r : { ...r, pass: false })],
    [development, [...controls.slice(1), controls[1]]],
  ]) assert.equal(developmentGatePassed(file, cases, checks), false);
  const final = file.cases.find(c => c.split === 'final')!;
  assert.equal(developmentGatePassed(file, [...development, { id: final.id, pass: true }], controls), true);
});

test('partial, duplicate and unknown results cannot count as complete coverage', () => {
  assert.equal(hasEvaluationCoverage(development, development), true);
  assert.equal(hasEvaluationCoverage(development, development.slice(1)), false);
  assert.equal(hasEvaluationCoverage(development, [...development.slice(1), development[1]]), false);
  assert.equal(hasEvaluationCoverage(development, [...development.slice(1), { id: 'unknown' }]), false);
});

function cli(args: string[]) {
  const env = { ...process.env };
  delete env.CAMELAI_API_KEY;
  return spawnSync(process.execPath, ['--import', 'tsx', 'scripts/eval-consultation-agents.ts', ...args], {
    env, encoding: 'utf8', timeout: 10000,
  });
}

test('standalone finals are rejected before credentials or provider pricing are requested', () => {
  const result = cli(['--split', 'final', '--confirm-final']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /finales requieren desarrollo y controles en la misma corrida/);
});

test('a limited all run cannot consume a subset of reserved final cases', () => {
  const result = cli(['--split', 'all', '--confirm-final', '--limit', '33']);
  assert.equal(result.status, 2);
  assert.match(result.stderr, /medición final no admite una selección parcial/);
});

test('dry run identifies samples without claiming full phase coverage or invoking a provider', () => {
  const result = cli(['--dry-run', '--split', 'desarrollo', '--limit', '1']);
  assert.equal(result.status, 0);
  const report = JSON.parse(result.stdout);
  assert.equal(report.cases, 1);
  assert.equal(report.expected_cases, 32);
  assert.equal(report.selection_complete, false);
  const final = cli(['--dry-run', '--split', 'final', '--confirm-final']);
  assert.equal(final.status, 0);
  assert.equal(JSON.parse(final.stdout).guardian_controls, 0);
  const all = cli(['--dry-run', '--split', 'all', '--confirm-final']);
  assert.equal(all.status, 0);
  const plan = JSON.parse(all.stdout);
  assert.equal(plan.cases, 40);
  assert.equal(plan.guardian_controls, 6);
  assert.equal(plan.selection_complete, true);
  assert.equal(plan.full_evaluation_passed, false);
  assert.equal(plan.maximum_authorized_usd, 2.52);
});

function syntheticRun(args: string[]) {
  const dir = mkdtempSync(join(tmpdir(), 'victoriosas-eval-gate-'));
  const output = join(dir, 'report.json');
  // Every request is intercepted in the child before the CLI is imported.
  // Generic invalid replies deliberately fail grading without reading holdouts.
  const stub = `globalThis.fetch=async(url)=>new Response(JSON.stringify(String(url).endsWith('/v1/models')
    ? [{id:'anthropic/claude-haiku-5-5',cost:{input:0.01,output:0.01,cacheWrite:0.01}}]
    : {status:'completed',text:'{}',usage:{costUsd:0.001}}));`;
  try {
    const result = spawnSync(process.execPath, ['--import', 'tsx', '--import', 'data:text/javascript,' + encodeURIComponent(stub),
      'scripts/eval-consultation-agents.ts', ...args, '--out', output], {
      env: { ...process.env, CAMELAI_API_KEY: 'synthetic-test-only' }, encoding: 'utf8', timeout: 10000,
    });
    assert.equal(result.status, 1);
    return JSON.parse(readFileSync(output, 'utf8'));
  } finally {
    if (existsSync(output)) unlinkSync(output);
    rmdirSync(dir);
  }
}

test('real CLI report marks a development sample incomplete even when its selected work finished', () => {
  const report = syntheticRun(['--split', 'desarrollo', '--limit', '1']);
  assert.equal(report.results.length, 1);
  assert.equal(report.controls.length, 6);
  assert.equal(report.expected_cases, 32);
  assert.equal(report.complete, false);
  assert.equal(report.summary.gate_ok, false);
  assert.equal(report.full_evaluation_passed, false);
});

test('real CLI never executes a final case after failed development or controls', () => {
  const report = syntheticRun(['--split', 'all', '--confirm-final']);
  assert.equal(report.results.length, 32);
  assert.ok(report.results.every((r: { id: string }) => development.some(c => c.id === r.id)));
  assert.equal(report.expected_cases, 40);
  assert.equal(report.complete, false);
  assert.equal(report.full_evaluation_passed, false);
});
