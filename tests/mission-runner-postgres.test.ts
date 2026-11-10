import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createMissionLedger, PersistentMissionOrchestrator } from '../src/autopilot/missionRuntime';
import { SyntheticMissionExecutor, SYNTHETIC_GOAL, SYNTHETIC_PLAN, SYNTHETIC_SEED } from '../src/autopilot/syntheticMissionExecutor';
import type { ExecutorAdapter } from '../src/autopilot/executorAdapter';

const database = process.env.MISSION_TEST_DATABASE_URL;
const psql = process.env.PSQL_PATH || 'psql';
const exec = promisify(execFile);
if (database) {
  const target = new URL(database);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname));
  assert.equal(target.pathname, '/victoriosa_mission_runner_test');
  assert.equal(target.search, '');
}
const literal = (value: unknown) => `'${(typeof value === 'object' ? JSON.stringify(value) : String(value)).replaceAll("'", "''")}'`;
async function sql(query: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(psql, [database!, '-X', '-qAt', '-v', 'ON_ERROR_STOP=1'],
      { windowsHide: true, timeout: 15000 }, (err, out) => err ? reject(Error('synthetic_sql_failed')) : resolve(out.trim()));
    child.stdin!.end(`set request.jwt.claim.role='service_role';\n${query}`);
  });
}
// Test-only local transport calls the exact SQL RPCs; no hosted service credentials or network fallback.
function localRpcClient() {
  const parameters: Record<string, string[]> = {
    six_agent_claim: ['p_agent', 'p_lease_seconds'],
    six_agent_checkpoint: ['p_task_id', 'p_mission_id', 'p_token', 'p_checkpoint_version', 'p_operation_id', 'p_executor_id', 'p_checkpoint'],
    six_agent_complete: ['p_task_id', 'p_token', 'p_evidence'],
    six_agent_fail: ['p_task_id', 'p_token', 'p_reason'],
  };
  return { async rpc(name: string, args: Record<string, unknown>) {
    assert.ok(Object.hasOwn(parameters, name));
    const values = parameters[name].map(key => literal(args[key]) + (key === 'p_checkpoint' ? '::jsonb' : '')).join(',');
    try {
      const query = name === 'six_agent_claim'
        ? `select coalesce(json_agg(c),'[]'::json) from public.${name}(${values}) c;`
        : `select to_json(public.${name}(${values}));`;
      return { data: JSON.parse(await sql(query)), error: null };
    } catch { return { data: null, error: { message: 'synthetic_rpc_failed' } }; }
  } } as unknown as SupabaseClient;
}

if (process.argv[2] === '--worker') {
  const config = JSON.parse(process.argv[3]) as { repo: string; root: string; sha: string; pause: boolean };
  const inner = new SyntheticMissionExecutor(config.pause ? 'synthetic-first' : 'synthetic-replacement', config.repo, config.root, config.sha);
  const executor: ExecutorAdapter = { executorId: inner.executorId, async execute(context, signal) {
    const result = await inner.execute(context, signal);
    if (config.pause && context.checkpoint.current_step_id === 'modify') {
      process.send!({ state: 'effect_before_checkpoint' });
      await new Promise(() => { setInterval(() => {}, 1000); });
    }
    return result;
  } };
  await new PersistentMissionOrchestrator(createMissionLedger(localRpcClient(), ['synthetic_worktree'])).runMission(executor, 'software');
  process.send!({ state: 'completed' });
  process.disconnect!();
} else {
  test('Autopilot executes a synthetic worktree mission and resumes an uncheckpointed effect in another process',
    { skip: !database, timeout: 90000 }, async (t) => {
      // A freshly created dedicated database is required; no existing schema is dropped.
      const bootstrap = (await readFile('scripts/test-six-agent-queue.sh', 'utf8')).match(/<<'SQL'\r?\n([\s\S]*?)\r?\nSQL/)![1];
      await sql(bootstrap);
      await sql(await readFile('supabase/staged/six_agent_queue_20261025.sql', 'utf8'));
      await sql(await readFile('supabase/staged/six_agent_mission_checkpoint_20261109.sql', 'utf8'));
      const temporary = await mkdtemp(path.join(tmpdir(), 'autopilot-mission-'));
      const repo = path.join(temporary, 'seed'); const root = path.join(temporary, 'worktrees');
      await mkdir(repo); await mkdir(root);
      const git = (args: string[]) => exec('git', args, { cwd: repo, windowsHide: true, timeout: 15000 });
      await git(['init']); await git(['config', 'user.name', 'Synthetic Autopilot']);
      await git(['config', 'user.email', 'synthetic@example.invalid']);
      const { writeFile } = await import('node:fs/promises');
      await writeFile(path.join(repo, 'synthetic-seed.txt'), SYNTHETIC_SEED);
      await git(['add', 'synthetic-seed.txt']);
      await git(['-c', 'core.hooksPath=/dev/null', '-c', 'commit.gpgsign=false', 'commit', '-m', 'synthetic seed']);
      const sha = (await git(['rev-parse', 'HEAD'])).stdout.trim();
      const missionId = 'synthetic-recovery';
      const input = { mission_schema_version: '1', goal: 'untrusted shadow goal', goal_version: 1, plan_version: 1,
        plan: SYNTHETIC_PLAN, restrictions: ['local_synthetic_only', 'no_network', 'no_send'], completion_criteria: ['synthetic_test_passed'] };
      await sql(`insert into public.agent_tasks(id,mission_id,goal,actor,action,status,agent_id,input)
        values('${missionId}','${missionId}',${literal(SYNTHETIC_GOAL)},'test-runner','synthetic_task','queued','software',${literal(input)}::jsonb);`);
      const workers: ChildProcess[] = [];
      const start = (pause: boolean) => {
        const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--worker', JSON.stringify({ repo, root, sha, pause })],
          { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true });
        // Keep bounded error diagnostics containing only the synthetic fixture's failures.
        let stderr = ''; child.stderr!.on('data', data => { stderr = (stderr + data).slice(-2000); });
        workers.push(child);
        return { child, message: Promise.race([
          once(child, 'message', { signal: AbortSignal.timeout(30000) }).then(([message]) => message),
          once(child, 'exit').then(() => { throw Error(`synthetic_worker_exited:${stderr}`); }),
        ]) };
      };
      try {
        const first = start(true);
        assert.deepEqual(await first.message, { state: 'effect_before_checkpoint' });
        const artifact = path.join(root, missionId, '.autopilot-synthetic/result.txt');
        const before = await stat(artifact);
        const durable = JSON.parse(await sql(`select row_to_json(t) from (select mission_checkpoint_version,mission_checkpoint,execution_token from public.agent_tasks where id='${missionId}') t;`));
        assert.equal(durable.mission_checkpoint_version, 1);
        assert.deepEqual(durable.mission_checkpoint.completed_steps, ['prepare']);
        const ended = once(first.child, 'exit'); first.child.kill('SIGKILL'); await ended;
        await sql(`update public.agent_tasks set lease_until=clock_timestamp()-interval '1 second' where id='${missionId}';`);
        await t.test('expired executor cannot persist checkpoint or close/fail the mission', async () => {
          const expired = { ...durable.mission_checkpoint };
          const params = `'${missionId}','${missionId}','${durable.execution_token}',2,'stale-operation-2','synthetic-first',${literal(expired)}::jsonb`;
          assert.equal(await sql(`select public.six_agent_checkpoint(${params});`), 'f');
          assert.equal(await sql(`select public.six_agent_complete('${missionId}','${durable.execution_token}','stale:completion');`), 'f');
          assert.equal(await sql(`select public.six_agent_fail('${missionId}','${durable.execution_token}','stale_executor');`), 'f');
        });
        const replacement = start(false);
        assert.deepEqual(await replacement.message, { state: 'completed' });
        const final = JSON.parse(await sql(`select row_to_json(t) from (select status,attempt_count,mission_checkpoint_version,mission_checkpoint from public.agent_tasks where id='${missionId}') t;`));
        assert.equal(final.status, 'completed'); assert.equal(final.attempt_count, 2);
        assert.equal(final.mission_checkpoint_version, 4);
        assert.deepEqual(final.mission_checkpoint.completed_steps, ['prepare', 'modify', 'verify']);
        assert.equal(final.mission_checkpoint.results[1].summary, 'synthetic_effect_reconciled');
        assert.equal(final.mission_checkpoint.results[2].summary, 'synthetic_test_passed');
        assert.equal((await stat(artifact)).mtimeMs, before.mtimeMs, 'already-applied effect was rewritten');
        const audit = JSON.parse(await sql(`select json_agg(t order by id) from (select id,event_type,details from public.agent_audit_events where task_id='${missionId}') t;`));
        assert.deepEqual(audit.map((event: { event_type: string }) => event.event_type), [
          'six_agent_claim', 'mission_checkpoint_saved', 'six_agent_claim', 'mission_checkpoint_saved', 'mission_checkpoint_saved', 'six_agent_complete']);
        assert.equal(audit[1].details.executor_id, 'synthetic-first');
        assert.equal(audit[3].details.executor_id, 'synthetic-replacement');
        assert.equal(await sql(`select public.six_agent_fail('${missionId}','${durable.execution_token}','obsolete_executor');`), 'f');
        assert.equal(await sql("select count(*) from public.six_agent_claim('software',60);"), '0');
        await t.test('a conflicting existing artifact is rejected rather than overwritten or executed', async () => {
          const original = await readFile(artifact, 'utf8');
          await writeFile(artifact, 'conflicting synthetic content');
          try {
            await assert.rejects(new SyntheticMissionExecutor('negative-check', repo, root, sha).execute({
              mission: { missionId, goal: SYNTHETIC_GOAL, goalVersion: 1, planVersion: 1, plan: SYNTHETIC_PLAN,
                restrictions: input.restrictions, completionCriteria: input.completion_criteria },
              checkpointVersion: 4, executorId: 'negative-check', permissions: ['synthetic_worktree'],
              checkpoint: { ...final.mission_checkpoint, current_step_id: 'verify' },
            }), /artifact_conflict/);
            assert.equal(await readFile(artifact, 'utf8'), 'conflicting synthetic content');
          } finally { await writeFile(artifact, original); }
        });
        console.log(JSON.stringify({ missionId, status: final.status, checkpointVersion: 4, auditEvents: audit.length,
          effectReconciled: true, staleWritesRejected: true, worktree: final.mission_checkpoint.worktree }));
      } finally {
        for (const worker of workers) if (worker.exitCode === null && worker.signalCode === null) worker.kill('SIGKILL');
        // Preserve the disposable worktree and audit for inspection until the test environment is discarded.
      }
    });
}
