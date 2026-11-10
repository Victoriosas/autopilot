import { readFile, lstat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { setTimeout as sleep } from 'node:timers/promises';
import { readLocalConfig } from '../src/autopilot/localMissionConfig';
import { LocalMissionStore, missionId, admissionRequest } from '../src/autopilot/localMissionStore';
import { ManagedProcesses } from '../src/autopilot/managedProcesses';
import { createMissionLedger, PersistentMissionOrchestrator } from '../src/autopilot/missionRuntime';
import { DeterministicSyntheticPlanner } from '../src/autopilot/missionPlanner';
import { SyntheticMissionExecutor } from '../src/autopilot/syntheticMissionExecutor';
import type { ExecutorAdapter } from '../src/autopilot/executorAdapter';

const emit = (event: object) => process.stdout.write(`${JSON.stringify(event)}\n`);
async function main() {
  const [command, ...rest] = process.argv.slice(2);
  if (command === '--help') { emit({ commands: ['init --config FILE','admit --config FILE --request FILE',
    'run --config FILE --id ID','status --config FILE --id ID','cancel --config FILE --id ID'], scope: 'manual_local_synthetic_only' }); return; }
  if (!['init','admit','run','status','cancel'].includes(command)) throw Error('invalid_command');
  const args: Record<string,string> = {};
  for (let i = 0; i < rest.length; i += 2) {
    if (!['--config','--request','--id'].includes(rest[i]) || !rest[i+1] || args[rest[i]]) throw Error('invalid_arguments');
    args[rest[i]] = rest[i+1];
  }
  const expected = command === 'init' ? ['--config'] : command === 'admit' ? ['--config','--request'] : ['--config','--id'];
  if (JSON.stringify(Object.keys(args).sort()) !== JSON.stringify(expected.sort())) throw Error('invalid_arguments');
  const config = await readLocalConfig(args['--config']);
  const controls = new ManagedProcesses(); const control = new LocalMissionStore(config, controls);
  try {
    if (command === 'init') { await control.initialize(); emit({ event:'initialized', scope:'local_synthetic_lab' }); return; }
    if (command === 'admit') {
      const info = await lstat(args['--request']);
      if (!info.isFile() || info.isSymbolicLink() || info.size>8192) throw Error('invalid_request_file');
      const request = admissionRequest(JSON.parse(await readFile(args['--request'],'utf8')));
      emit({ event:'admission', missionId:request.id, state:await control.admit(request) }); return;
    }
    const id = missionId(args['--id']);
    if (command === 'status') { emit({ event:'status', mission:await control.status(id) }); return; }
    if (command === 'cancel') { const changed=await control.cancel(id); emit({ event:'cancellation', changed, mission:await control.status(id) }); return; }
    if (!config.permissions.execute) throw Error('host_permission_required');
    await control.status(id); // Reject unknown/unbound tasks before spawning any executor.
    const runId = randomUUID(); let claimed=false;
    const report = (event: Record<string, unknown>) => { if (event.event==='claimed') claimed=true; emit({ ...event,runId,missionId:id }); };
    const processes = new ManagedProcesses(event => report(event));
    const controller = new AbortController(); const monitorStop = new AbortController();
    const monitorProcesses = new ManagedProcesses(); const monitorStore = new LocalMissionStore(config,monitorProcesses,monitorStop.signal);
    const store = new LocalMissionStore(config,processes,controller.signal,report);
    const timer = setTimeout(()=>controller.abort(Error('run_timeout')),config.deadlineMs);
    const interrupted=()=>controller.abort(Error('operator_interrupted'));
    process.once('SIGINT',interrupted); process.once('SIGTERM',interrupted);
    const watch = (async()=>{
      while (!monitorStop.signal.aborted) {
        try {
          await sleep(250,undefined,{signal:monitorStop.signal});
          if (!claimed) continue;
          const state=await monitorStore.status(id);
          if (state.queueState!=='running' || state.runId!==runId || !state.leaseActive) {
            controller.abort(Error(state.state==='cancelled'?'cancelled_by_operator':'lease_lost')); return;
          }
        } catch { if (!monitorStop.signal.aborted) controller.abort(Error('supervision_failed')); return; }
      }
    })();
    let errorCode: string | undefined;
    emit({ event:'run_started',missionId:id,runId,manual:true });
    try {
      const inner=new SyntheticMissionExecutor(`local:${runId}`,config.resources.repository,config.resources.worktreeRoot,config.resources.baseSha,processes);
      const executor: ExecutorAdapter={executorId:inner.executorId,observe:(context,signal)=>inner.observe(context,signal),execute:async(context,signal)=>{
        report({event:'step_started',stepId:context.checkpoint.current_step_id,planVersion:context.mission.planVersion});
        const result=await inner.execute(context,signal);
        report({event:'step_effect',stepId:context.checkpoint.current_step_id,summary:result.events[0]?.summary}); return result;
      }};
      await new PersistentMissionOrchestrator(createMissionLedger(store.client(id,runId),['synthetic_worktree']),config.deadlineMs,
        new DeterministicSyntheticPlanner()).runMission(executor,'software',controller.signal);
    } catch (error) {
      errorCode=controller.signal.aborted ? controller.signal.reason.message : error instanceof Error ? error.message : 'execution_failed';
    } finally {
      clearTimeout(timer); monitorStop.abort(); await watch;
      await Promise.all([processes.close(),monitorProcesses.close()]);
      process.removeListener('SIGINT',interrupted); process.removeListener('SIGTERM',interrupted);
    }
    if (errorCode==='run_timeout' || errorCode==='operator_interrupted') await store.recordInterruption(control,errorCode);
    const final=await control.status(id);
    const busy=!claimed && final.queueState==='running';
    emit({event:'run_closed',missionId:id,runId,claimed,outcome:busy?'busy':final.state,reason:final.reason??errorCode??null,
      childrenRemaining:processes.size,mission:final});
    if (busy) process.exitCode=3;
    else if (errorCode && final.state!=='completed' && final.state!=='cancelled' && final.state!=='blocked') process.exitCode=2;
  } finally { await controls.close(); }
}
main().catch(error=>{ const message=error instanceof Error ? error.message : ''; emit({event:'error',code:/^[a-z][a-z0-9_]{2,63}$/.test(message)?message:'operation_failed'}); process.exitCode=2; });
