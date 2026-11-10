import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn, type ChildProcess } from 'node:child_process';
import { promisify } from 'node:util';
import { once } from 'node:events';
import { mkdtemp, mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createMissionLedger, PersistentMissionOrchestrator } from '../src/autopilot/missionRuntime';
import { DeterministicSyntheticPlanner, SYNTHETIC_ACCEPTANCE, SYNTHETIC_RESOURCES, SYNTHETIC_RESTRICTIONS,
  type AuthorizedSyntheticObjective, type MissionPlanner } from '../src/autopilot/missionPlanner';
import { SyntheticMissionExecutor, SYNTHETIC_CONTENTS, SYNTHETIC_GOAL, SYNTHETIC_SEED, SYNTHETIC_TEST_SOURCE } from '../src/autopilot/syntheticMissionExecutor';
import type { ExecutorAdapter } from '../src/autopilot/executorAdapter';
import { missionTestDatabase, sqlLiteral as literal } from './fixtures/missionTestDatabase';

const database = process.env.PLANNER_TEST_DATABASE_URL;
const { sql, client } = missionTestDatabase(database, 'victoriosa_mission_planner_test');
const exec = promisify(execFile);
type Fault = 'none' | 'drop_test' | 'drop_test_twice' | 'conflict' | 'conflict_test';
type PlannerMode = 'normal' | 'invalid' | 'expand' | 'outside';
type Config = { repo: string; root: string; sha: string; id: string; fault: Fault; planner: PlannerMode; pause: boolean; pauseOnClaim?: boolean };
function objective(maxReplans = 1): AuthorizedSyntheticObjective {
  return { version: 1, kind: 'synthetic.ensure_verified_artifact', expected: 'canonical_synthetic_result',
    restrictions: [...SYNTHETIC_RESTRICTIONS], resources: [...SYNTHETIC_RESOURCES], acceptance: [...SYNTHETIC_ACCEPTANCE], limits: { maxReplans, maxSteps: 8 } };
}

if (process.argv[2] === '--worker') {
  const config = JSON.parse(process.argv[3]) as Config;
  const inner = new SyntheticMissionExecutor(config.pause ? 'planner-first' : 'planner-replacement', config.repo, config.root, config.sha);
  const ledger = createMissionLedger(client, ['synthetic_worktree']);
  if (config.pauseOnClaim) {
    const claim = ledger.claimMission;
    ledger.claimMission = async agent => {
      const context = await claim(agent);
      process.send!({ state: 'claimed_for_recovery' });
      await once(process, 'message');
      return context;
    };
  }
  const save = ledger.savePlan!;
  ledger.savePlan = async (context, proposal, plannerId) => {
    const accepted = await save(context, proposal, plannerId);
    // Fault injection only: after durable plan 1. No corrective content or step is supplied by the fixture.
    if (accepted && proposal.version === 1 && config.fault !== 'none') {
      const folder = path.join(config.root, config.id, '.autopilot-synthetic');
      if (config.fault === 'drop_test' || config.fault === 'drop_test_twice') await unlink(path.join(folder, 'result.test.cjs'));
      else if (config.fault === 'conflict_test') { await mkdir(folder); await writeFile(path.join(folder, 'result.test.cjs'), 'conflicting verification fixture'); }
      else await writeFile(path.join(folder, 'result.txt'), 'unrecoverable synthetic conflict');
    }
    return accepted;
  };
  const base = new DeterministicSyntheticPlanner();
  const planner: MissionPlanner = { plannerId: 'synthetic-test-planner', async propose(context, observed, signal) {
    const proposal = await base.propose(context, observed, signal);
    if (config.planner === 'invalid') proposal.steps[0].depends_on = [proposal.steps[0].id];
    if (config.planner === 'expand') proposal.resources.push('network');
    if (config.planner === 'outside') proposal.steps[0].task = 'shell:arbitrary';
    return proposal;
  } };
  const executor: ExecutorAdapter = { executorId: inner.executorId, observe: (context, signal) => inner.observe(context, signal), async execute(context, signal) {
    const result = await inner.execute(context, signal);
    if (config.fault === 'drop_test_twice' && context.mission.planVersion === 2
      && context.mission.plan.find(s => s.id === context.checkpoint.current_step_id)?.task === 'synthetic.modify') {
      await unlink(path.join(config.root, config.id, '.autopilot-synthetic/result.test.cjs'));
    }
    if (config.pause && context.mission.planVersion === 2
      && context.mission.plan.find(s => s.id === context.checkpoint.current_step_id)?.task === 'synthetic.modify') {
      process.send!({ state: 'effect_before_checkpoint' });
      await new Promise(() => { setInterval(() => {}, 1000); });
    }
    return result;
  } };
  await new PersistentMissionOrchestrator(ledger, 45000, planner).runMission(executor, 'software');
  process.send!({ state: 'finished' }); process.disconnect!();
} else {
  test('ORD-204D derives, adapts, persists and resumes plans from objectives without fixture-supplied steps',
    { skip: !database, timeout: 150000 }, async (t) => {
      const bootstrap = (await readFile('scripts/test-six-agent-queue.sh', 'utf8')).match(/<<'SQL'\r?\n([\s\S]*?)\r?\nSQL/)![1];
      await sql(bootstrap);
      for (const file of ['six_agent_queue_20261025.sql', 'six_agent_mission_checkpoint_20261109.sql', 'six_agent_mission_planning_20261109.sql']) {
        await sql(await readFile(`supabase/staged/${file}`, 'utf8'));
      }
      const fixtureRoot = await mkdtemp(path.join(tmpdir(), 'autopilot-planner-'));
      const repo = path.join(fixtureRoot, 'seed'); const root = path.join(fixtureRoot, 'worktrees');
      await mkdir(repo); await mkdir(root);
      const git = (args: string[]) => exec('git', ['-c', 'core.hooksPath=/dev/null', ...args], { cwd: repo, windowsHide: true, timeout: 15000 });
      await git(['init']); await git(['config', 'user.name', 'Synthetic Autopilot']); await git(['config', 'user.email', 'synthetic@example.invalid']);
      await writeFile(path.join(repo, 'synthetic-seed.txt'), SYNTHETIC_SEED);
      await git(['add', 'synthetic-seed.txt']); await git(['-c', 'commit.gpgsign=false', 'commit', '-m', 'synthetic seed']);
      const sha = (await git(['rev-parse', 'HEAD'])).stdout.trim();
      const workers: ChildProcess[] = [];
      const start = (config: Config) => {
        const child = spawn(process.execPath, ['--import', 'tsx', fileURLToPath(import.meta.url), '--worker', JSON.stringify(config)],
          { stdio: ['ignore', 'ignore', 'pipe', 'ipc'], windowsHide: true });
        let stderr = ''; child.stderr!.on('data', data => { stderr = (stderr + data).slice(-2000); }); workers.push(child);
        return { child, message: Promise.race([
          once(child, 'message', { signal: AbortSignal.timeout(45000) }).then(([message]) => message),
          once(child, 'exit').then(() => { throw Error(`synthetic_worker_exited:${stderr}`); }),
        ]) };
      };
      const seed = async (id: string, state: 'absent' | 'empty' | 'ready') => {
        if (state === 'absent') return;
        const worktree = path.join(root, id); await git(['worktree', 'add', '-b', `codex/${id}`, worktree, sha]);
        if (state === 'ready') {
          const folder = path.join(worktree, '.autopilot-synthetic'); await mkdir(folder);
          await writeFile(path.join(folder, 'result.txt'), SYNTHETIC_CONTENTS);
          await writeFile(path.join(folder, 'result.test.cjs'), SYNTHETIC_TEST_SOURCE);
        }
      };
      const enqueue = async (id: string, goal: unknown) => {
        const input = { mission_schema_version: '1', goal_version: 1, objective: goal };
        assert.equal(Object.hasOwn(input, 'plan'), false); assert.equal(Object.hasOwn(input, 'plan_version'), false);
        await sql(`insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input) values('${id}',${literal(SYNTHETIC_GOAL)},'test-runner','synthetic_task','queued','software',${literal(input)}::jsonb);`);
      };
      const row = async (id: string) => JSON.parse(await sql(`select row_to_json(t) from (select status,input,attempt_count,mission_checkpoint,mission_checkpoint_version,execution_token from public.agent_tasks where id='${id}') t;`));
      const audit = async (id: string) => JSON.parse(await sql(`select coalesce(json_agg(t order by id),'[]'::json) from (select id,event_type,details from public.agent_audit_events where task_id='${id}') t;`));
      try {
        const initialPlans: string[][] = [];
        for (const state of ['absent', 'empty', 'ready'] as const) await t.test(`derive from ${state} state${state === 'ready' ? ', adapt and recover after real process loss' : ''}`, async () => {
          const id = `synthetic-planner-${state}`; const goal = objective(); await seed(id, state); await enqueue(id, goal);
          const config: Config = { repo, root, sha, id, fault: state === 'ready' ? 'drop_test' : 'none', planner: 'normal', pause: state === 'ready' };
          const first = start(config);
          if (state === 'ready') {
            assert.deepEqual(await first.message, { state: 'effect_before_checkpoint' });
            const saved = await row(id); assert.equal(saved.input.plan_version, 2);
            assert.equal(saved.mission_checkpoint_version, 2); assert.deepEqual(saved.mission_checkpoint.completed_steps, []);
            const files = ['result.txt', 'result.test.cjs'].map(name => path.join(root, id, '.autopilot-synthetic', name));
            const before = await Promise.all(files.map(file => stat(file)));
            const token = saved.execution_token; const proposal = saved.input.plan_history[1];
            const replay = `'${id}','${token}',2,'plan:${id}:2','synthetic-test-planner',${literal(proposal)}::jsonb`;
            assert.equal(await sql(`select public.six_agent_save_plan(${replay});`), 't');
            assert.equal((await audit(id)).length, 3, 'replay duplicated a plan audit event');
            const wrongPlanVersion = { ...saved.mission_checkpoint, worktree: { branch: `codex/${id}`, sha }, plan_version: 1 };
            assert.equal(await sql(`select public.six_agent_checkpoint('${id}','${id}','${token}',3,'wrong-plan-version','planner-first',${literal(wrongPlanVersion)}::jsonb);`), 'f');
            const exited = once(first.child, 'exit'); first.child.kill('SIGKILL'); await exited;
            await sql(`update public.agent_tasks set lease_until=clock_timestamp()-interval '1 second' where id='${id}';`);
            assert.equal(await sql(`select public.six_agent_save_plan(${replay});`), 'f');
            assert.equal(await sql(`select public.six_agent_checkpoint('${id}','${id}','${token}',3,'stale-plan-checkpoint','planner-first',${literal(saved.mission_checkpoint)}::jsonb);`), 'f');
            assert.equal(await sql(`select public.six_agent_complete('${id}','${token}','stale:completion');`), 'f');
            assert.equal(await sql(`select public.six_agent_fail('${id}','${token}','stale_executor');`), 'f');
            assert.equal(await sql(`select public.six_agent_block_mission('${id}','${token}',2,'stale_executor');`), 'f');
            const replacement = start({ ...config, fault: 'none', pause: false, pauseOnClaim: true });
            assert.deepEqual(await replacement.message, { state: 'claimed_for_recovery' });
            const reclaimed = await row(id);
            assert.equal(reclaimed.status, 'running'); assert.notEqual(reclaimed.execution_token, token);
            assert.equal(reclaimed.input.plan_version, 2); assert.equal(reclaimed.mission_checkpoint_version, 2);
            assert.equal(await sql(`select public.six_agent_save_plan(${replay});`), 'f');
            assert.equal(await sql(`select public.six_agent_checkpoint('${id}','${id}','${token}',3,'stale-live-takeover','planner-first',${literal(saved.mission_checkpoint)}::jsonb);`), 'f');
            assert.equal(await sql(`select public.six_agent_complete('${id}','${token}','stale:completion');`), 'f');
            assert.equal(await sql(`select public.six_agent_fail('${id}','${token}','stale_executor');`), 'f');
            assert.equal(await sql(`select public.six_agent_block_mission('${id}','${token}',2,'stale_executor');`), 'f');
            const finished = once(replacement.child, 'message', { signal: AbortSignal.timeout(30000) });
            replacement.child.send('resume');
            assert.deepEqual((await finished)[0], { state: 'finished' });
            for (let i = 0; i < files.length; i++) assert.equal((await stat(files[i])).mtimeMs, before[i].mtimeMs, 'effect was repeated on recovery');
            assert.equal(await sql(`select public.six_agent_save_plan(${replay});`), 'f');
            assert.equal(await sql(`select public.six_agent_checkpoint('${id}','${id}','${token}',3,'stale-after-recovery','planner-first',${literal(saved.mission_checkpoint)}::jsonb);`), 'f');
            assert.equal(await sql(`select public.six_agent_complete('${id}','${token}','stale:completion');`), 'f');
            assert.equal(await sql(`select public.six_agent_fail('${id}','${token}','stale_executor');`), 'f');
            assert.equal(await sql(`select public.six_agent_block_mission('${id}','${token}',2,'stale_executor');`), 'f');
          } else assert.deepEqual(await first.message, { state: 'finished' });
          const final = await row(id); assert.equal(final.status, 'completed'); assert.deepEqual(final.input.objective, goal);
          initialPlans.push(final.input.plan_history[0].steps.map((step: { task: string }) => step.task));
          if (state === 'ready') {
            assert.equal(final.attempt_count, 2); assert.equal(final.input.plan_version, 2); assert.equal(final.mission_checkpoint_version, 5);
            assert.deepEqual(final.input.plan_history.map((p: { reason: string }) => p.reason), ['initial_state', 'artifacts_missing']);
            assert.equal(final.input.plan_history[1].observation.test, 'missing');
            assert.deepEqual(final.input.plan_history[1].steps.map((s: { task: string }) => s.task), ['synthetic.modify', 'synthetic.verify']);
            assert.equal(final.mission_checkpoint.results[0].summary, 'synthetic_effect_reconciled');
            assert.equal((await audit(id)).length, 7);
          }
          console.log(JSON.stringify({ id, initialPlan: initialPlans.at(-1), planVersions: final.input.plan_history.length,
            finalSteps: final.input.plan.map((s: { id: string }) => s.id), status: final.status, checkpointVersion: final.mission_checkpoint_version,
            attempts: final.attempt_count, auditEvents: (await audit(id)).length, objectivePreserved: true }));
        });
        assert.deepEqual(initialPlans, [
          ['synthetic.prepare', 'synthetic.modify', 'synthetic.verify'], ['synthetic.modify', 'synthetic.verify'], ['synthetic.verify'],
        ]);
        const negatives: Array<{ id: string; goal?: unknown; fault?: Fault; planner?: PlannerMode; reason: string }> = [
          { id: 'unsupported', goal: { ...objective(), kind: 'send_email' }, reason: 'objective_not_admitted' },
          { id: 'invalid', planner: 'invalid', reason: 'invalid_plan' },
          { id: 'expand', planner: 'expand', reason: 'permission_expansion' },
          { id: 'outside', planner: 'outside', reason: 'action_not_allowed' },
          { id: 'irrecoverable', fault: 'conflict', reason: 'unrecoverable_state' },
          { id: 'exhausted', fault: 'drop_test_twice', reason: 'replan_budget_exhausted' },
        ];
        for (const negative of negatives) await t.test(`explicit terminal denial: ${negative.id}`, async () => {
          const id = `synthetic-negative-${negative.id}`; await seed(id, 'ready'); await enqueue(id, negative.goal ?? objective());
          const config: Config = { repo, root, sha, id, fault: negative.fault ?? 'none', planner: negative.planner ?? 'normal', pause: false };
          assert.deepEqual(await start(config).message, { state: 'finished' });
          const final = await row(id); assert.equal(final.status, 'blocked'); assert.equal(final.mission_checkpoint.last_error, negative.reason);
          assert.equal(final.execution_token, null); assert.deepEqual(final.input.objective, negative.goal ?? objective());
          assert.deepEqual(final.mission_checkpoint.completed_steps, negative.id === 'exhausted' ? ['modify-v2'] : []);
          if (negative.id === 'exhausted') { assert.equal(final.input.plan_version, 2); assert.equal(final.input.plan_history.length, 2); }
          const folder = path.join(root, id, '.autopilot-synthetic');
          assert.equal(await readFile(path.join(folder, 'result.txt'), 'utf8'), negative.fault === 'conflict' ? 'unrecoverable synthetic conflict' : SYNTHETIC_CONTENTS);
          if (negative.fault === 'drop_test' || negative.fault === 'drop_test_twice') await assert.rejects(stat(path.join(folder, 'result.test.cjs')), { code: 'ENOENT' });
          else assert.equal(await readFile(path.join(folder, 'result.test.cjs'), 'utf8'), SYNTHETIC_TEST_SOURCE);
          assert.equal((await audit(id)).at(-1).event_type, 'mission_blocked');
          console.log(JSON.stringify({ id, status: final.status, reason: negative.reason, prohibitedEffects: 0 }));
        });
        await t.test('database roles cannot invoke planning or terminal writes anonymously', async () => {
          assert.equal(await sql("select has_function_privilege('anon','public.six_agent_save_plan(text,uuid,integer,text,text,jsonb)','execute');"), 'f');
          assert.equal(await sql("select has_function_privilege('authenticated','public.six_agent_block_mission(text,uuid,integer,text)','execute');"), 'f');
        });
        await t.test('a conflict discovered after planning cannot cause a partial write of the missing result', async () => {
          const id = 'synthetic-preflight-conflict'; await seed(id, 'empty'); await enqueue(id, objective());
          assert.deepEqual(await start({ repo, root, sha, id, fault: 'conflict_test', planner: 'normal', pause: false }).message, { state: 'finished' });
          const final = await row(id); assert.equal(final.status, 'blocked'); assert.equal(final.mission_checkpoint.last_error, 'unrecoverable_state');
          await assert.rejects(stat(path.join(root, id, '.autopilot-synthetic/result.txt')), { code: 'ENOENT' });
        });
        await t.test('plan state and audit roll back together; concurrent replay saves one version and event', async () => {
          const id = 'synthetic-plan-atomic'; await enqueue(id, objective());
          const ledger = createMissionLedger(client, ['synthetic_worktree']);
          const context = (await ledger.claimMission('software'))!;
          const observer = new SyntheticMissionExecutor('atomic-observer', repo, root, sha);
          const proposal = await new DeterministicSyntheticPlanner().propose(context, await observer.observe(context));
          await sql(`create function public.reject_plan_audit() returns trigger language plpgsql as $$ begin
            if new.task_id='${id}' and new.event_type='mission_plan_saved' then raise exception 'synthetic_audit_failure'; end if;
            return new; end $$; create trigger reject_plan_audit before insert on public.agent_audit_events for each row execute function public.reject_plan_audit();`);
          try { await assert.rejects(ledger.savePlan!(context, proposal, 'atomic-planner'), /plan_write_failed/); }
          finally { await sql('drop trigger reject_plan_audit on public.agent_audit_events; drop function public.reject_plan_audit();'); }
          const rollback = await row(id); assert.equal(rollback.mission_checkpoint_version, 0); assert.equal(context.checkpointVersion, 0);
          assert.equal(Object.hasOwn(rollback.input, 'plan'), false); assert.equal((await audit(id)).length, 1);
          const token = rollback.execution_token;
          const params = `'${id}','${token}',1,'plan:${id}:1','atomic-planner',${literal(proposal)}::jsonb`;
          assert.deepEqual(await Promise.all([sql(`select public.six_agent_save_plan(${params});`), sql(`select public.six_agent_save_plan(${params});`)]), ['t', 't']);
          const saved = await row(id); assert.equal(saved.mission_checkpoint_version, 1); assert.equal(saved.input.plan_history.length, 1);
          assert.equal((await audit(id)).filter((e: { event_type: string }) => e.event_type === 'mission_plan_saved').length, 1);
          const expanded = { ...proposal, version: 2, reason: 'artifacts_missing', resources: [...proposal.resources, 'network'] };
          assert.equal(await sql(`select public.six_agent_save_plan('${id}','${token}',2,'expanded-operation','atomic-planner',${literal(expanded)}::jsonb);`), 'f');
          assert.equal(await sql(`select public.six_agent_block_mission('${id}','${token}',0,'stale_version');`), 'f');
          assert.equal(await sql(`select public.six_agent_block_mission('${id}','${token}',1,'synthetic_audit_verified');`), 't');
        });
      } finally { for (const worker of workers) if (worker.exitCode === null && worker.signalCode === null) worker.kill('SIGKILL'); }
    });
}
