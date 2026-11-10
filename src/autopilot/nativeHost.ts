import path from 'node:path';
import { lstat, realpath, readFile, open, stat } from 'node:fs/promises';
import { createHash, randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';
import { localProcessEnvironment, readLocalConfig, validateLocalConfig } from './localMissionConfig';
import { ManagedProcesses } from './managedProcesses';
import type { LocalMissionStatus } from './localMissionStore';

export const nativeMission = 'synthetic-native-ord204g';
export const nativeTask = '\\Victoriosas-Autopilot-Synthetic-Demo';
export interface NativeManifest {
  version: 1; checkout: string; approvedSha: string; executionConfig: string; configSha256: string;
  evidenceDirectory: string; taskName: typeof nativeTask; missionId: typeof nativeMission;
  node: string; git: string; psql: string; maxDurationMs: number;
}
function exact(v: unknown, keys: string[]) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === keys.sort().join(',');
}
export function manifest(value: unknown): NativeManifest {
  const m = value as NativeManifest;
  if (!exact(m,['version','checkout','approvedSha','executionConfig','configSha256','evidenceDirectory','taskName','missionId','node','git','psql','maxDurationMs'])
    || m.version !== 1 || m.missionId !== nativeMission || m.taskName !== nativeTask
    || !/^[a-f0-9]{40}$/.test(m.approvedSha) || !/^[a-f0-9]{64}$/.test(m.configSha256)
    || !Number.isInteger(m.maxDurationMs) || m.maxDurationMs < 1000 || m.maxDurationMs > 60000
    || [m.checkout,m.executionConfig,m.evidenceDirectory,m.node,m.git,m.psql].some(v=>typeof v!=='string'||!path.isAbsolute(v))) throw Error('invalid_native_manifest');
  const relative=path.relative(m.checkout,m.evidenceDirectory);
  if (!relative || (!relative.startsWith('..'+path.sep)&&!path.isAbsolute(relative))) throw Error('evidence_inside_checkout');
  return m;
}
export async function canonical(file: string, directory=false) {
  const s=await lstat(file);
  if (s.isSymbolicLink() || (directory?!s.isDirectory():!s.isFile()) || await realpath(file)!==path.resolve(file)) throw Error('unsafe_native_path');
  return s;
}
export async function readManifest(file: string) {
  if ((await canonical(file)).size>16384) throw Error('invalid_native_manifest');
  return manifest(JSON.parse(await readFile(file,'utf8')));
}
export function disposition(s: LocalMissionStatus, now=Date.now()): string {
  if (['completed','blocked','cancelled'].includes(s.state)||['completed','blocked'].includes(s.queueState)) return 'terminal';
  if (s.queueState==='running'&&s.leaseActive) return 'busy';
  if (s.queueState==='failed'&&new Date(s.availableAt).getTime()>now) return 'backoff';
  // Expired running tasks must reach the existing SQL claim to close their exhausted budget.
  if (s.attempts>=s.maxAttempts&&s.queueState!=='running') return 'attempt_budget_exhausted';
  if (!['queued','failed','running'].includes(s.queueState)) throw Error('unsupported_queue_state');
  return 'ready';
}
export async function launchNativeHost(m: NativeManifest, manual: boolean) {
  manifest(m);
  const abort=new AbortController();
  const processes=new ManagedProcesses(event=>{if(audit) void record(event).catch(()=>abort.abort());});
  const timer=setTimeout(()=>abort.abort(Error('native_deadline')),m.maxDurationMs);
  const stop=()=>abort.abort(Error('native_interrupted'));
  process.once('SIGINT',stop); process.once('SIGTERM',stop);
  let audit: Awaited<ReturnType<typeof open>>|undefined;
  const invocationId=randomUUID();
  const env={...localProcessEnvironment(),PSQL_PATH:m.psql,
    PATH:[path.dirname(m.git),path.dirname(m.node),path.dirname(m.psql),path.join(process.env.SystemRoot||'/','System32')].join(path.delimiter)};
  const exec=(file: string,args: string[],operation: string,acceptExitCodes=[0],onStdout?: (chunk: string)=>void)=>processes.exec(file,args,
    {cwd:m.checkout,env,signal:abort.signal,timeout:m.maxDurationMs,operation,acceptExitCodes,onStdout});
  let auditQueue=Promise.resolve();
  const record=async(event: object)=>{
    const row={timestamp:new Date().toISOString(),invocationId,launcherPid:process.pid,missionId:m.missionId,sha:m.approvedSha,...event};
    auditQueue=auditQueue.then(async()=>{await audit!.write(`${JSON.stringify(row)}\n`);await audit!.sync();process.stdout.write(`${JSON.stringify(row)}\n`);});
    await auditQueue;
  };
  try {
    for (const dir of [m.checkout,m.evidenceDirectory]) await canonical(dir,true);
    if (await realpath(fileURLToPath(new URL('../../',import.meta.url)))!==path.resolve(m.checkout)) throw Error('wrong_launcher_checkout');
    if ((await canonical(m.executionConfig)).size>16384) throw Error('invalid_config_file');
    for (const file of [m.node,m.git,m.psql]) if (!(await stat(file)).isFile()) throw Error('invalid_host_binary');
    if(await realpath(m.node)!==await realpath(process.execPath)) throw Error('wrong_node_binary');
    const configBytes=await readFile(m.executionConfig);
    if (createHash('sha256').update(configBytes).digest('hex')!==m.configSha256) throw Error('native_config_changed');
    const config=validateLocalConfig(JSON.parse(configBytes.toString('utf8')));
    if (config.permissions.admit || !config.permissions.execute || config.permissions.cancel) throw Error('execution_only_required');
    if (config.deadlineMs+10000>m.maxDurationMs) throw Error('native_deadline_too_short');
    const sha=(await exec(m.git,['rev-parse','HEAD'],'verify_checkout')).stdout.trim();
    if (sha!==m.approvedSha) throw Error('unapproved_checkout');
    await exec(m.git,['diff','--quiet','HEAD','--'],'verify_tracked_files');
    if ((await exec(m.git,['ls-files','--others','--exclude-standard'],'verify_untracked_files')).stdout.trim()) throw Error('untracked_checkout_files');
    const origin=manual?{mode:'manual',nativeEvent:null,user:userInfo().username}:
      JSON.parse((await exec(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),
        ['-NoProfile','-NonInteractive','-File',path.join(m.checkout,'tools/native-host/Read-TaskOrigin.ps1'),'-LauncherPid',String(process.pid)],'native_origin')).stdout);
    if (!manual && (origin.mode!=='windows_task_event'||origin.pid!==process.pid||origin.taskName!==nativeTask||!Number.isInteger(origin.recordId))) throw Error('native_origin_missing');
    audit=await open(path.join(m.evidenceDirectory,`${invocationId}.jsonl`),'wx',0o600);
    await record({event:'host_started',origin});
    // Freeze the validated host configuration for this invocation; never read a payload as config.
    const snapshot=path.join(m.evidenceDirectory,`${invocationId}.execution.json`);
    const sealed=await open(snapshot,'wx',0o600);try {await sealed.write(configBytes);await sealed.sync();} finally {await sealed.close();}
    await readLocalConfig(snapshot); // Canonical resources before querying/claiming any mission.
    if ((await exec(m.git,['-C',config.resources.repository,'rev-parse','--verify',`${config.resources.baseSha}^{commit}`],'verify_seed_commit')).stdout.trim()!==config.resources.baseSha) throw Error('seed_commit_missing');
    const cli=path.join(m.checkout,'scripts/autopilot-mission.ts');
    const invoke=async(command: 'status'|'run')=>{
      const events: Record<string,any>[]=[];let buffer='';
      const observe=(chunk: string)=>{
        buffer+=chunk;const lines=buffer.split(/\r?\n/);buffer=lines.pop()!;
        for(const line of lines.filter(Boolean)) {
          const e=JSON.parse(line);events.push(e);
          if(['run_started','run_closed','claimed'].includes(e.event)) void record({event:e.event,runId:e.runId,claimed:e.claimed,outcome:e.outcome,reason:e.reason}).catch(()=>abort.abort());
        }
      };
      const r=await exec(m.node,['--import','tsx',cli,command,'--config',snapshot,'--id',m.missionId],`cli_${command}`,[0,2,3],observe);
      await auditQueue;
      if(buffer.trim()) throw Error('incomplete_cli_output');
      if (r.exitCode===2) throw Error('cli_rejected');
      return {events,exitCode:r.exitCode};
    };
    const before=(await invoke('status')).events.at(-1)?.mission as LocalMissionStatus;
    if (!before || before.id!==m.missionId) throw Error('mission_not_admitted');
    const decision=disposition(before);
    if (decision!=='ready') {
      await record({event:'host_closed',outcome:decision,reason:before.reason,attempts:before.attempts,queueState:before.queueState});
      return decision==='busy'?3:decision==='backoff'?4:decision==='attempt_budget_exhausted'?5:0;
    }
    const run=await invoke('run');
    const closed=run.events.find(e=>e.event==='run_closed');
    if (!closed) throw Error('missing_run_closure');
    await record({event:'host_closed',outcome:closed.outcome,reason:closed.reason,runId:closed.runId,attempts:closed.mission?.attempts});
    return run.exitCode===3?3:closed.mission?.state==='completed'||closed.mission?.state==='cancelled'?0:5;
  } catch (e) {
    const reason=e instanceof Error&&/^[a-z_]{3,64}$/.test(e.message)?e.message:'native_launch_failed';
    if (audit) await record({event:'host_closed',outcome:'rejected',reason});
    throw Error(reason);
  } finally {
    clearTimeout(timer); await processes.close(); await auditQueue.catch(()=>{}); await audit?.close();
    process.removeListener('SIGINT',stop);process.removeListener('SIGTERM',stop);
  }
}
