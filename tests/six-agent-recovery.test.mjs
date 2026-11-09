import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';

const database = process.env.AUTOPILOT_TEST_DATABASE_URL;
const psql = process.env.PSQL_PATH || 'psql';
if (database) {
  const target = new URL(database);
  assert.ok(['127.0.0.1', 'localhost'].includes(target.hostname), 'loopback only');
  assert.equal(target.pathname, '/victoriosa_six_agent_test', 'disposable database only');
}
function sql(query) {
  return new Promise((resolve, reject) => {
    const child = execFile(psql, [database, '-X', '-q', '-A', '-t', '-v', 'ON_ERROR_STOP=1'],
      { windowsHide: true, timeout: 15000 }, (error, out) => error ? reject(new Error('test_sql_failed')) : resolve(out.trim()));
    child.stdin.end(`set request.jwt.claim.role='service_role';\n${query}`);
  });
}

// Child holds no database transaction open: killing it models executor loss after a durable claim.
if (process.argv[2] === '--claim-worker') {
  const result = await sql("select row_to_json(c) from public.six_agent_claim('software',5) c;");
  process.send(JSON.parse(result));
  setInterval(() => {}, 1000);
} else {
  test('persisted queue fences expired executors and recovers after process loss',
    { skip: !database, timeout: 30000 }, async (t) => {
      const id = `recovery-${randomUUID()}`;
      let worker;
      try {
        await sql(`insert into public.agent_tasks(id,goal,actor,action,status,agent_id,input)
          values('${id}','synthetic recovery','codex','analyze','queued','software','{"synthetic":true}');`);
        worker = spawn(process.execPath, [import.meta.filename, '--claim-worker'],
          { stdio: ['ignore', 'ignore', 'ignore', 'ipc'], windowsHide: true });
        const claim = await Promise.race([
          once(worker, 'message', { signal: AbortSignal.timeout(10000) }).then(([message]) => message),
          once(worker, 'exit').then(() => { throw Error('worker_exited_before_claim'); }),
        ]);
        assert.equal(claim.task_id, id);
        const exited = once(worker, 'exit');
        worker.kill('SIGKILL');
        await exited;

        await t.test('a live lease prevents another process from claiming', async () => {
          assert.equal(await sql("select count(*) from public.six_agent_claim('software',5);"), '0');
        });
        // Expire deterministically rather than waiting for a scheduler or changing the system clock.
        await sql(`update public.agent_tasks set lease_until=clock_timestamp()-interval '1 second' where id='${id}';`);
        await t.test('expired token cannot complete or fail, even before takeover', async () => {
          assert.equal(await sql(`select public.six_agent_complete('${id}','${claim.claim_token}','synthetic:evidence');`), 'f');
          assert.equal(await sql(`select public.six_agent_fail('${id}','${claim.claim_token}','executor_lost');`), 'f');
          assert.equal(await sql(`select count(*) from public.agent_audit_events where task_id='${id}';`), '1');
        });
        const recovered = JSON.parse(await sql("select row_to_json(c) from public.six_agent_claim('software',5) c;"));
        assert.equal(recovered.task_id, id);
        assert.notEqual(recovered.claim_token, claim.claim_token);
        await t.test('old token stays fenced after takeover and completion is single use', async () => {
          assert.equal(await sql(`select public.six_agent_fail('${id}','${claim.claim_token}','stale_executor');`), 'f');
          assert.equal(await sql(`select public.six_agent_complete('${id}','${claim.claim_token}','stale:evidence');`), 'f');
          assert.equal(await sql(`select public.six_agent_complete('${id}','${recovered.claim_token}','synthetic:recovered');`), 't');
          assert.equal(await sql(`select public.six_agent_complete('${id}','${recovered.claim_token}','synthetic:duplicate');`), 'f');
          assert.equal(await sql(`select status||':'||attempt_count from public.agent_tasks where id='${id}';`), 'completed:2');
          assert.equal(await sql(`select string_agg(event_type,',' order by id) from public.agent_audit_events where task_id='${id}';`),
            'six_agent_claim,six_agent_claim,six_agent_complete');
        });
        await t.test('expiry inside a transaction uses wall time for both writes', async () => {
          await sql(`insert into public.agent_tasks(id,goal,actor,action,status,agent_id)
            values('${id}-clock','synthetic clock','codex','analyze','queued','software');`);
          const timed = JSON.parse(await sql("select row_to_json(c) from public.six_agent_claim('software',5) c;"));
          assert.equal(timed.task_id, `${id}-clock`);
          const result = await sql(`begin;
            update public.agent_tasks set lease_until=clock_timestamp()+interval '50 milliseconds' where id='${id}-clock';
            do $$ begin perform pg_sleep(0.1); end $$;
            select public.six_agent_complete('${id}-clock','${timed.claim_token}','synthetic:expired');
            select public.six_agent_fail('${id}-clock','${timed.claim_token}','expired_executor');
            commit;`);
          assert.deepEqual(result.split(/\r?\n/), ['f', 'f']);
        });
        await t.test('a current executor can still fail and retry backoff remains enforced', async () => {
          const active = JSON.parse(await sql("select row_to_json(c) from public.six_agent_claim('software',5) c;"));
          assert.equal(active.task_id, `${id}-clock`);
          assert.equal(await sql(`select public.six_agent_fail('${id}-clock','${active.claim_token}','synthetic_failure');`), 't');
          assert.equal(await sql("select count(*) from public.six_agent_claim('software',5);"), '0');
          assert.equal(await sql(`select status||':'||attempt_count from public.agent_tasks where id='${id}-clock';`), 'failed:2');
        });
      } finally {
        if (worker && worker.exitCode === null && worker.signalCode === null) worker.kill('SIGKILL');
        await sql(`delete from public.agent_audit_events where task_id in ('${id}','${id}-clock');
          delete from public.agent_tasks where id in ('${id}','${id}-clock');`);
      }
    });
}
