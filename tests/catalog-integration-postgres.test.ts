import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { readFile, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { missionTestDatabase, sqlLiteral as literal } from './fixtures/missionTestDatabase';
import { createMissionLedger, PersistentMissionOrchestrator } from '../src/autopilot/missionRuntime';
import { CatalogMissionExecutor, CATALOG_GOAL, CATALOG_PERMISSION, CATALOG_PLAN, CATALOG_RESTRICTIONS } from '../src/autopilot/catalogMissionExecutor';
import { SyntheticCatalogConnector } from '../src/integrations/syntheticCatalogConnector';

const database = process.env.CATALOG_TEST_DATABASE_URL;
const { sql, client } = missionTestDatabase(database, 'victoriosa_catalog_demo');

test('normal SQL mission entry uses read-only catalog with durable permission, outage, quota and shutdown evidence',
  { skip: !database, timeout: 60000 }, async () => {
    if (process.env.CATALOG_DEMO_RECEIPT) {
      // The demo must reject other local accounts, not merely hide its data directory.
      const target = new URL(database!);
      assert.equal(target.password, '');
      const passFile = process.env.PGPASSFILE!;
      assert.ok(passFile);
      if (process.platform !== 'win32') assert.equal((await stat(passFile)).mode & 0o777, 0o600);
      await assert.rejects(stat(path.join(path.dirname(passFile), 'initdb-password')), { code: 'ENOENT' });
      const args = [database!, '-X', '-w', '-qAt', '-c', 'select 1'];
      const unauthenticated = spawnSync(process.env.PSQL_PATH || 'psql', args, {
        timeout: 15000, encoding: 'utf8', env: { ...process.env,
          PGPASSFILE: `${process.env.CATALOG_DEMO_RECEIPT}.no-password`, PGPASSWORD: '', LC_ALL: 'C' },
      });
      assert.notEqual(unauthenticated.status, 0, 'demo must reject passwordless TCP connections');
      assert.match(unauthenticated.stderr, /no password supplied/);
      const wrongPassword = spawnSync(process.env.PSQL_PATH || 'psql', args, {
        timeout: 15000, encoding: 'utf8', env: { ...process.env, PGPASSWORD: 'invalid-demo-password', LC_ALL: 'C' },
      });
      assert.notEqual(wrongPassword.status, 0, 'demo must reject incorrect passwords');
      assert.match(wrongPassword.stderr, /password authentication failed/);
      assert.equal(await sql('show password_encryption;'), 'scram-sha-256');
      assert.equal(await sql("select count(*) from pg_hba_file_rules where auth_method <> 'scram-sha-256' or error is not null;"), '0');
      assert.equal(await sql('select 1;'), '1', 'authorized demo clients still connect');
    }
    const bootstrap = (await readFile('scripts/test-six-agent-queue.sh', 'utf8')).match(/<<'SQL'\r?\n([\s\S]*?)\r?\nSQL/)![1];
    await sql(bootstrap);
    for (const file of ['six_agent_queue_20261025.sql', 'six_agent_mission_checkpoint_20261109.sql'])
      await sql(await readFile(`supabase/staged/${file}`, 'utf8'));
    const source = { branch: execFileSync('git', ['branch', '--show-current'], { encoding: 'utf8' }).trim(),
      sha: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim() };
    const sourceClean = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim().length === 0;
    let enabled = true, available = true;
    const connector = new SyntheticCatalogConnector({ enabled: () => enabled, available: () => available, maxCalls: 1 });
    const executor = new CatalogMissionExecutor('catalog-demo-executor', connector, async event => {
      await sql(`insert into public.agent_audit_events(task_id,event_type,details)
        values(${literal(event.missionId)},${literal(event.event)},${literal(event)}::jsonb);`);
    }, source);
    const cases: Array<{ id: string; outcome: string; calls: number }> = [];
    for (const scenario of ['denied', 'authorized', 'budget', 'unavailable', 'disabled']) {
      const id = `synthetic-catalog-${scenario}`;
      if (scenario === 'unavailable') available = false;
      if (scenario === 'disabled') { available = true; enabled = false; }
      const input = { mission_schema_version: '1', goal_version: 1, plan_version: 1,
        plan: CATALOG_PLAN, restrictions: CATALOG_RESTRICTIONS, completion_criteria: ['synthetic_catalog_read'],
        // A task's self-declared permission is deliberately ignored by createMissionLedger.
        permissions: [CATALOG_PERMISSION] };
      await sql(`insert into public.agent_tasks(id,goal,actor,action,status,agent_id,max_attempts,input)
        values(${literal(id)},${literal(CATALOG_GOAL)},'synthetic-catalog-demo','synthetic_task','queued','software',1,${literal(input)}::jsonb);`);
      const permissions = scenario === 'denied' ? [] : [CATALOG_PERMISSION];
      const run = () => new PersistentMissionOrchestrator(createMissionLedger(client, permissions)).runMission(executor, 'software');
      if (scenario === 'authorized') await run();
      else await assert.rejects(run(), /executor_failed/);
      const row = JSON.parse(await sql(`select json_build_object('status',status,'attempt',attempt_count,
        'checkpoint_version',mission_checkpoint_version,'checkpoint',mission_checkpoint,
        'active_lease',lease_until is not null,'token_present',execution_token is not null,
        'completed_evidence',completed_evidence) from public.agent_tasks where id=${literal(id)};`));
      const audit = JSON.parse(await sql(`select coalesce(json_agg(json_build_object('event',event_type,'details',details,'at',created_at) order by id),'[]')
        from public.agent_audit_events where task_id=${literal(id)};`));
      assert.equal(row.attempt, 1); assert.equal(row.active_lease, false); assert.equal(row.token_present, false);
      assert.equal(audit[0].event, 'six_agent_claim');
      if (scenario === 'authorized') {
        assert.equal(row.status, 'completed'); assert.equal(row.checkpoint_version, 2);
        assert.equal(row.checkpoint.mission_state, 'completed');
        assert.equal(audit.at(-1).event, 'six_agent_complete');
        assert.equal(audit.filter(e => e.event === 'catalog_read_completed').length, 1);
        const oracle = new SyntheticCatalogConnector({ enabled: () => true, available: () => true, maxCalls: 1 });
        const expectedHash = createHash('sha256').update(JSON.stringify(await oracle.searchProducts({ limit: 2 }))).digest('hex');
        assert.deepEqual(row.checkpoint.artifacts, [`synthetic-catalog:sha256:${expectedHash}`]);
        assert.deepEqual(row.checkpoint.completed_steps, ['catalog-read']);
        // Completed normal entry cannot reclaim or read a second time.
        const auditCount = audit.length;
        await run();
        assert.equal(Number(await sql(`select count(*) from public.agent_audit_events where task_id=${literal(id)};`)), auditCount);
      } else {
        assert.equal(row.status, 'blocked'); assert.equal(row.checkpoint.mission_state, 'blocked');
        assert.equal(row.completed_evidence, null);
        const reason = scenario === 'denied' ? 'catalog_authorization_required' : `catalog_${scenario === 'budget' ? 'budget_exhausted' : scenario}`;
        assert.ok(audit.some(e => e.event === 'catalog_read_denied' && e.details.reason === reason));
        assert.ok(!audit.some(e => e.event === 'catalog_read_completed' || e.event === 'six_agent_complete'));
        assert.equal(audit.at(-1).event, 'six_agent_failure');
      }
      assert.equal(connector.consumedCalls, scenario === 'denied' ? 0 : 1);
      cases.push({ id, outcome: row.status, calls: connector.consumedCalls });
    }
    // Separate psql observers read the durable SQL rows and audit, not executor-returned data.
    const receipt = { label: 'SIMULADO', environment: 'disposable_loopback_postgresql', source, sourceClean, cases,
      externallySent: false, externalProviderCalls: 0, catalogCalls: connector.consumedCalls,
      tasks: JSON.parse(await sql(`select json_agg(json_build_object('id',id,'status',status,'attempts',attempt_count,
        'checkpoint_version',mission_checkpoint_version,'checkpoint',mission_checkpoint) order by id) from public.agent_tasks;`)),
      audit: JSON.parse(await sql(`select json_agg(json_build_object('task',task_id,'event',event_type,'details',details,'at',created_at) order by id)
        from public.agent_audit_events;`)) };
    if (process.env.CATALOG_DEMO_RECEIPT) await writeFile(process.env.CATALOG_DEMO_RECEIPT, JSON.stringify(receipt, null, 2) + '\n');
    console.log(JSON.stringify({ label: receipt.label, source, cases, catalogCalls: 1, externalProviderCalls: 0 }));
  });
