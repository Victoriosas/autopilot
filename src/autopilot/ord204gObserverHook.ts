import { nativeMission } from './nativeHost';
import { validateWindow, type TestWindow } from './ord204gWindowManager';

export function observerHook(window: TestWindow) {
  validateWindow(window);
  const hook = 'ord204g_observe_first_recovery_checkpoint';
  return {
    install: `begin;
create function public.${hook}() returns trigger language plpgsql set search_path='' as $body$
begin
  if clock_timestamp() < '${window.secondTrigger}'::timestamptz - interval '15 seconds'
  then perform pg_sleep(8); end if;
  return NEW;
end $body$;
create trigger ${hook} before update of mission_checkpoint on public.agent_tasks for each row
when (OLD.id='${nativeMission}' and OLD.attempt_count=1 and OLD.status='running'
  and not (OLD.mission_checkpoint->'completed_steps' ? 'modify-v1')
  and NEW.mission_checkpoint->'completed_steps' ? 'modify-v1')
execute function public.${hook}();
commit;`,
    remove: `begin; drop trigger ${hook} on public.agent_tasks; drop function public.${hook}(); commit;`,
  };
}
