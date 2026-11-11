import assert from 'node:assert/strict';
import test from 'node:test';
import { nativeMission } from '../src/autopilot/nativeHost';
import { observerHook } from '../src/autopilot/ord204gObserverHook';
import { makeWindow } from '../src/autopilot/ord204gWindowManager';
import { missionTestDatabase, sqlLiteral } from './fixtures/missionTestDatabase';

const target = process.env.ORD204G_OBSERVER_TEST_DATABASE_URL;
const { sql } = missionTestDatabase(target,'ord204g_observer_test');

test('the observation hook delays only the first recovery checkpoint and can be removed', { skip:!target }, async () => {
  const template = new Date(Date.now() - 3 * 60 * 60_000 + 60_000).toISOString().slice(0,19) + '-03:00';
  const hook = observerHook(makeWindow(template));
  const id = sqlLiteral(nativeMission);
  const modification = '{"completed_steps":["modify-v1"]}';
  await sql(`create table public.agent_tasks(id text primary key, attempt_count int, status text, mission_checkpoint jsonb);
    insert into public.agent_tasks values (${id},1,'running','{"completed_steps":[]}'),('synthetic-unrelated',1,'running','{"completed_steps":[]}');`);
  await sql(hook.install);
  try {
    await sql(`set statement_timeout=1000; update public.agent_tasks set mission_checkpoint='${modification}' where id='synthetic-unrelated';`);
    await assert.rejects(sql(`set statement_timeout=400; update public.agent_tasks set mission_checkpoint='${modification}' where id=${id};`),
      /synthetic_sql_failed/);
    assert.equal(await sql(`select mission_checkpoint->'completed_steps' from public.agent_tasks where id=${id};`),'[]');
    await sql(`set statement_timeout=1000; update public.agent_tasks set attempt_count=2 where id=${id};
      update public.agent_tasks set mission_checkpoint='${modification}' where id=${id};`);
  } finally {
    await sql(hook.remove);
  }
  assert.equal(await sql("select to_regprocedure('public.ord204g_observe_first_recovery_checkpoint()') is null;"),'t');
});
