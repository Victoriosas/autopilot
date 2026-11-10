import path from 'node:path';
import { lstat, realpath, readFile, open, stat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { userInfo } from 'node:os';
import { localProcessEnvironment, readLocalConfig, validateLocalConfig } from './localMissionConfig';
import { ManagedProcesses } from './managedProcesses';
import type { LocalMissionStatus } from './localMissionStore';

export const nativeMission = 'synthetic-native-ord204g-recovery-20261110';
export const nativeTask = '\\Victoriosas-Autopilot-Synthetic-Demo';
export interface NativeManifest {
  version: 1; checkout: string; approvedSha: string; executionConfig: string; configSha256: string;
  evidenceDirectory: string; taskName: typeof nativeTask; missionId: typeof nativeMission;
  node: string; git: string; psql: string; maxDurationMs: number;
}
function exact(v: unknown, keys: string[]) {
  return !!v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).sort().join(',') === keys.sort().join(',');
}
export function isInside(parent: string, child: string) {
  const relative = path.relative(parent, child);
  return !relative || (!relative.startsWith('..' + path.sep) && relative !== '..' && !path.isAbsolute(relative));
}
export function manifest(value: unknown): NativeManifest {
  const m = value as NativeManifest;
  if (!exact(m,['version','checkout','approvedSha','executionConfig','configSha256','evidenceDirectory','taskName','missionId','node','git','psql','maxDurationMs'])
    || m.version !== 1 || m.missionId !== nativeMission || m.taskName !== nativeTask
    || !/^[a-f0-9]{40}$/.test(m.approvedSha) || !/^[a-f0-9]{64}$/.test(m.configSha256)
    || !Number.isInteger(m.maxDurationMs) || m.maxDurationMs < 1000 || m.maxDurationMs > 60000
    || [m.checkout,m.executionConfig,m.evidenceDirectory,m.node,m.git,m.psql].some(v=>typeof v!=='string'||!path.isAbsolute(v))) throw Error('invalid_native_manifest');
  if (isInside(m.checkout,m.evidenceDirectory)) throw Error('evidence_inside_checkout');
  return m;
}
export async function canonical(file: string, directory=false) {
  const s=await lstat(file);
  if (s.isSymbolicLink() || (directory?!s.isDirectory():!s.isFile()) || await realpath(file)!==path.resolve(file)) throw Error('unsafe_native_path');
  return s;
}
export async function readManifest(file: string) {
  if ((await canonical(file)).size>16384) throw Error('invalid_native_manifest');
  return manifest(JSON.parse((await readFile(file,'utf8')).replace(/^\uFEFF/, '')));
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
export type NativePreflightStage = 'checkout_path' | 'evidence_path' | 'launcher_checkout' | 'config_path'
  | 'host_binaries' | 'node_identity' | 'config_hash' | 'config_schema' | 'config_permissions'
  | 'config_deadline' | 'git_head' | 'git_tracked' | 'git_untracked' | 'native_origin' | 'audit_open' | 'execution';

export function nativeOriginRejection(exitCode: number): string {
  switch (exitCode) {
    case 10: return 'native_history_disabled';
    case 11: return 'native_event_query_failed';
    case 12: return 'native_event_missing';
    case 13: return 'native_event_ambiguous';
    default: return 'native_origin_process_failed';
  }
}

export async function launchNativeHost(m: NativeManifest, manual: boolean, invocationId: string,
  stage: (name: NativePreflightStage, rejection: string) => void) {
  manifest(m);
  if (!/^[a-f0-9-]{36}$/.test(invocationId)) throw Error('invalid_invocation_id');
  const abort=new AbortController();
  const processes=new ManagedProcesses(event=>{if(audit) void record(event).catch(()=>abort.abort());});
  const timer=setTimeout(()=>abort.abort(Error('native_deadline')),m.maxDurationMs);
  const stop=()=>abort.abort(Error('native_interrupted'));
  process.once('SIGINT',stop); process.once('SIGTERM',stop);
  let audit: Awaited<ReturnType<typeof open>>|undefined;
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
    stage('checkout_path', 'unsafe_checkout_path');
    await canonical(m.checkout,true);
    stage('evidence_path', 'unsafe_evidence_path');
    await canonical(m.evidenceDirectory,true);
    stage('launcher_checkout', 'wrong_launcher_checkout');
    if (await realpath(fileURLToPath(new URL('../../',import.meta.url)))!==path.resolve(m.checkout)) throw Error('wrong_launcher_checkout');
    stage('config_path', 'invalid_config_file');
    if ((await canonical(m.executionConfig)).size>16384) throw Error('invalid_config_file');
    stage('host_binaries', 'invalid_host_binary');
    for (const file of [m.node,m.git,m.psql]) if (!(await stat(file)).isFile()) throw Error('invalid_host_binary');
    stage('node_identity', 'wrong_node_binary');
    if(await realpath(m.node)!==await realpath(process.execPath)) throw Error('wrong_node_binary');
    const configBytes=await readFile(m.executionConfig);
    stage('config_hash', 'native_config_changed');
    if (createHash('sha256').update(configBytes).digest('hex')!==m.configSha256) throw Error('native_config_changed');
    stage('config_schema', 'invalid_execution_config');
    const config=validateLocalConfig(JSON.parse(configBytes.toString('utf8')));
    stage('config_permissions', 'execution_only_required');
    if (config.permissions.admit || !config.permissions.execute || config.permissions.cancel) throw Error('execution_only_required');
    stage('config_deadline', 'native_deadline_too_short');
    if (config.deadlineMs+10000>m.maxDurationMs) throw Error('native_deadline_too_short');
    stage('git_head', 'checkout_head_unavailable');
    const sha=(await exec(m.git,['rev-parse','HEAD'],'verify_checkout')).stdout.trim();
    stage('git_head', 'unapproved_checkout');
    if (sha!==m.approvedSha) throw Error('unapproved_checkout');
    stage('git_tracked', 'tracked_checkout_check_failed');
    const diff = await exec(m.git,['diff','--quiet','HEAD','--'],'verify_tracked_files',[0,1]);
    stage('git_tracked', 'tracked_checkout_changed');
    if (diff.exitCode === 1) throw Error('tracked_checkout_changed');
    stage('git_untracked', 'untracked_checkout_check_failed');
    const untracked = await exec(m.git,['ls-files','--others','--exclude-standard'],'verify_untracked_files');
    stage('git_untracked', 'untracked_checkout_files');
    if (untracked.stdout.trim()) throw Error('untracked_checkout_files');
    stage('native_origin', 'native_origin_process_failed');
    let origin;
    if (manual) {
      origin = { mode: 'manual', nativeEvent: null, user: userInfo().username };
    } else {
      const result = await exec(path.join(process.env.SystemRoot||'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe'),
        ['-NoProfile','-NonInteractive','-File',path.join(m.checkout,'tools/native-host/Read-TaskOrigin.ps1'),'-LauncherPid',String(process.pid)],
        'native_origin',[0,10,11,12,13]);
      if (result.exitCode !== 0) {
        const rejection = nativeOriginRejection(result.exitCode);
        stage('native_origin', rejection);
        throw Error(rejection);
      }
      stage('native_origin', 'native_origin_invalid');
      origin = JSON.parse(result.stdout);
      if (origin?.mode!=='windows_task_event'||origin.pid!==process.pid||origin.taskName!==nativeTask||!Number.isInteger(origin.recordId)) throw Error('native_origin_invalid');
    }
    stage('audit_open', 'native_audit_unavailable');
    audit=await open(path.join(m.evidenceDirectory,`${invocationId}.jsonl`),'wx',0o600);
    await record({event:'host_started',origin});
    stage('execution', 'native_execution_rejected');
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
