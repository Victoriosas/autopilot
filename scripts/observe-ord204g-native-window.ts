import path from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createHash } from 'node:crypto';
import { readFile, readdir, stat, writeFile } from 'node:fs/promises';
import { setTimeout as sleep } from 'node:timers/promises';
import { canonical, nativeMission, nativeTask, readManifest } from '../src/autopilot/nativeHost';
import { hostBinding, readLocalConfig } from '../src/autopilot/localMissionConfig';
import { observerHook } from '../src/autopilot/ord204gObserverHook';
import { validateWindow, type TestWindow } from '../src/autopilot/ord204gWindowManager';

const exec = promisify(execFile);
const dataDirectory = 'c:/autopilot-worktrees/queue-fencing-20261109-pg';
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;
const sqlString = (text: string) => "'" + text.replaceAll("'", "''") + "'";
const controller = new AbortController();
const stop = () => controller.abort();
const powershell = path.join(process.env.SystemRoot ?? 'C:/Windows','System32/WindowsPowerShell/v1.0/powershell.exe');
const environment = Object.fromEntries(['SystemRoot','WINDIR','PATH','Path','TEMP','TMP'].flatMap(
  name => process.env[name] ? [[name,process.env[name]]] : [],
));

async function run() {
  if (process.platform !== 'win32') throw Error('windows_required');
  const [file, opensAt, ...extra] = process.argv.slice(2);
  if (!file || !path.isAbsolute(file) || !opensAt || extra.length) throw Error('invalid_observer_arguments');
  await canonical(file);
  const state = JSON.parse(await readFile(file,'utf8'));
  const selected = state.windows?.find((entry: TestWindow) => entry.opensAt === opensAt);
  const window = validateWindow(selected);
  if (window.authorization !== 'EXPLICIT' || !['PREPARED','ACTIVE'].includes(window.status)) throw Error('explicit_window_required');
  const current = Date.now();
  const first = Date.parse(window.firstTrigger);
  const second = Date.parse(window.secondTrigger);
  if (Intl.DateTimeFormat().resolvedOptions().timeZone !== 'America/Montevideo' || new Date().getTimezoneOffset() !== 180) {
    throw Error('observer_clock_uncertain');
  }
  if (current < Date.parse(window.opensAt) || current >= first - 10_000) throw Error('observer_outside_preparation_time');

  const root: string = selected.proposalDirectory;
  await canonical(root,true);
  const manifest = await readManifest(path.join(root,'manifest.json'));

  if (!/^[a-f0-9]{40}$/.test(state.verifiedSha) || state.verifiedSha !== manifest.approvedSha
      || path.relative(state.checkout,manifest.checkout) || path.relative(state.psqlPath,manifest.psql)
      || path.relative(path.join(root,'execution-host.json'),manifest.executionConfig)
      || path.relative(path.join(root,'evidence'),manifest.evidenceDirectory)
      || createHash('sha256').update(await readFile(manifest.executionConfig)).digest('hex') !== manifest.configSha256) {
    throw Error('observer_binding_rejected');
  }
  const config = await readLocalConfig(manifest.executionConfig);
  if (config.database.port !== 55439 || config.database.user !== 'postgres') throw Error('observer_binding_rejected');
  const git = async (args: string[]) => (await exec('git',args,{ cwd:manifest.checkout, timeout:5000 })).stdout.trim();
  if (await git(['rev-parse','HEAD']) !== manifest.approvedSha || await git(['status','--porcelain'])) throw Error('observer_checkout_rejected');
  await canonical(manifest.evidenceDirectory,true);
  const artifacts = ['result.txt','result.test.cjs'].map(name =>
    path.join(config.resources.worktreeRoot,nativeMission,'.autopilot-synthetic',name));
  const artifactState = async () => Promise.all(artifacts.map(async file => {
    try {
      await canonical(file);
      return { name:path.basename(file), mtimeMs:(await stat(file)).mtimeMs, sha256:createHash('sha256').update(await readFile(file)).digest('hex') };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
      return null;
    }
  }));
  if ((await artifactState()).some(Boolean)) throw Error('observer_artifact_already_exists');

  const id = sqlString(nativeMission);
  const binding = sqlString(hostBinding(config));
  const sql = (query: string): Promise<string> => new Promise((resolve,reject) => {
    const child = execFile(manifest.psql,['-h','127.0.0.1','-p','55439','-U','postgres','-d','victoriosa_mission_operator_lab',
      '-w','-X','-qAt','-v','ON_ERROR_STOP=1'],{ timeout:6000, windowsHide:true, env:environment },
    (error,stdout) => error ? reject(Error('observer_dedicated_sql_failed')) : resolve(stdout.trim()));
    child.stdin!.on('error',() => {});
    child.stdin!.end(`set statement_timeout=3500; set lock_timeout=2000; set request.jwt.claim.role='service_role';
do $guard$ begin
  if current_database() <> 'victoriosa_mission_operator_lab'
     or current_setting('listen_addresses') <> '127.0.0.1'
     or current_setting('port') <> '55439'
     or replace(lower(current_setting('data_directory')),chr(92),'/') <> ${sqlString(dataDirectory)}
     or not exists(select 1 from public.autopilot_local_lab where binding=${binding})
  then raise exception 'wrong_observer_lab'; end if;
end $guard$;
${query}`);
  });
  const save = async (name: string, evidence: object) => writeFile(path.join(manifest.evidenceDirectory,name),
    JSON.stringify({ timestamp:new Date().toISOString(), missionId:nativeMission, sha:manifest.approvedSha, ...evidence },null,2)+'\n',
    { flag:'wx', mode:0o600, flush:true });

  const active = await sql(`select count(*) from public.agent_tasks where id=${id} and status='queued' and attempt_count=0 and max_attempts>=2 and input->>'host_binding'=${binding};`);
  if (active !== '1' || Date.now() >= first - 5000) throw Error('observer_mission_not_ready');
  const hook = observerHook(window);
  let installed = false;
  const removeHook = async () => {
    if (!installed) return;
    await sql(hook.remove);
    installed = false;
  };
  try {
    await sql(hook.install);
    installed = true;
    await save('observer-ready.json',{ closesAt:window.closesAt, firstTrigger:window.firstTrigger });
    console.log('observer_ready');

    // The JSONL identifies a real task event and the exact child to observe.
    const verifiedChildren = new Set<string>();
    while (!controller.signal.aborted && Date.now() < second - 30_000) {
      for (const file of (await readdir(manifest.evidenceDirectory)).filter(name => /^[a-f0-9-]{36}\.jsonl$/i.test(name))) {
        const lines = (await readFile(path.join(manifest.evidenceDirectory,file),'utf8')).split('\n').slice(0,-1);
        const rows = lines.filter(Boolean).map(line => JSON.parse(line));
        const origin = rows.find(row => row.event === 'host_started');
        const child = rows.find(row => row.event === 'process_started' && row.operation === 'cli_run');
        const run = rows.find(row => row.event === 'run_started');
        const claim = rows.find(row => row.event === 'claimed');
        if (!origin || !child || !run || !claim || origin.missionId !== nativeMission
            || origin.origin?.mode !== 'windows_task_event' || origin.origin.taskName !== nativeTask
            || origin.launcherPid !== origin.origin.pid || !Number.isSafeInteger(origin.origin.recordId)
            || !uuid.test(origin.invocationId) || file !== origin.invocationId+'.jsonl'
            || !uuid.test(run.runId) || run.runId !== claim.runId
            || Date.parse(origin.origin.timestamp) < first - 2000 || Date.parse(origin.origin.timestamp) >= second
            || !Number.isSafeInteger(child.pid) || child.pid <= 0
            || !Number.isSafeInteger(origin.launcherPid) || origin.launcherPid <= 0) continue;
        const key = origin.invocationId + ':' + child.pid;
        if (!verifiedChildren.has(key)) {
          // The PID, parent, command and creation time are checked locally. Only a boolean leaves PowerShell.
          const spawnedAt = Date.parse(child.timestamp);
          if (!Number.isFinite(spawnedAt)) throw Error('observer_child_timestamp_invalid');
          const verify = `$p=Get-CimInstance Win32_Process -Filter 'ProcessId=${child.pid}'; if ($p -and $p.ParentProcessId -eq ${origin.launcherPid} -and $p.Name -eq 'node.exe' -and $p.CommandLine -like '*autopilot-mission.ts* run * --id ${nativeMission}*' -and [Math]::Abs(([datetimeoffset]$p.CreationDate).ToUnixTimeMilliseconds() - ${spawnedAt}) -lt 3000) { 'true' }`;
          const identity = await exec(powershell,['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(verify,'utf16le').toString('base64')],
            { timeout:3000, windowsHide:true });
          if (identity.stdout.trim() !== 'true') throw Error('observer_process_identity_changed');
          verifiedChildren.add(key);
        }
        const before = await artifactState();
        if (!before.every(Boolean)) continue;
        const lease = JSON.parse(await sql(`select json_build_object('token',execution_token,'checkpoint',mission_checkpoint_version,
          'plan',input->>'plan_version','leaseUntil',lease_until)
          from public.agent_tasks where id=${id} and status='running' and attempt_count=1
          and lease_until>clock_timestamp() and not (mission_checkpoint->'completed_steps' ? 'modify-v1');`) || 'null');
        if (!lease || !uuid.test(lease.token) || lease.checkpoint < 1 || lease.plan !== '1') throw Error('observer_lease_missing');
        if (Date.now() >= Date.parse(lease.leaseUntil) - 500) throw Error('observer_lease_margin_elapsed');
        if (controller.signal.aborted) throw Error('observer_interrupted');
        process.kill(child.pid,'SIGKILL');
        await save('observer-interruption.json',{ recordId:origin.origin.recordId, nativeAt:origin.origin.timestamp,
          invocationId:origin.invocationId, launcherPid:origin.launcherPid, executorPid:child.pid, runId:run.runId,
          checkpoint:lease.checkpoint, plan:Number(lease.plan), leaseUntil:lease.leaseUntil, artifacts:before });
        await removeHook();
        await sleep(Math.max(0,Date.parse(lease.leaseUntil) - Date.now() + 300),undefined,{ signal:controller.signal });
        if (Date.now() >= second - 8000) throw Error('observer_fencing_margin_elapsed');
        const stale = await sql(`select (lease_until<=clock_timestamp() and status='running' and execution_token=${sqlString(lease.token)}::uuid)
          from public.agent_tasks where id=${id};
          select public.six_agent_fail(${id},${sqlString(lease.token)}::uuid,'obsolete_executor');`);
        const staleWriteRejected = stale.split(/\r?\n/).join(',') === 't,f';
        await save('observer-fencing.json',{ naturalLeaseExpired:staleWriteRejected, staleWriteRejected, hookRemoved:true });
        if (!staleWriteRejected) throw Error('observer_fencing_unproved');
        return;
      }
      await sleep(40,undefined,{ signal:controller.signal });
    }
    throw Error('observer_first_effect_not_captured');
  } finally {
    await removeHook();
  }
}

process.once('SIGINT',stop);
process.once('SIGTERM',stop);
run().catch(error => {
  const code = error instanceof Error && /^[a-z_]{3,64}$/.test(error.message) ? error.message : 'observer_rejected';
  console.error(JSON.stringify({ event:'observer_failed', code }));
  process.exitCode = 2;
}).finally(() => {
  process.removeListener('SIGINT',stop);
  process.removeListener('SIGTERM',stop);
});
