import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, open, readFile, realpath, rename, unlink, writeFile } from 'node:fs/promises';
import { classify, nextWindow, validateWindow, windowManager, type HostSnapshot, type RetryEvidence, type TestWindow } from '../src/autopilot/ord204gWindowManager';
import { canonical, isInside, nativeMission, nativeTask, readManifest } from '../src/autopilot/nativeHost';

const exec = promisify(execFile);
const ps = path.join(process.env.SystemRoot ?? 'C:/Windows', 'System32/WindowsPowerShell/v1.0/powershell.exe');
const shaPattern = /^[0-9a-f]{40}$/;
interface Probe extends HostSnapshot { historyEnabled: boolean; taskStart?: string; taskStop?: string }
interface Continuity {
  version: 1;
  checkout: string;
  verifiedSha: string;
  psqlPath: string;
  consumedMissions?: string[];
  windows: (TestWindow & { proposalDirectory?: string })[];
}

const hostQuery = String.raw`
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$task = 'absent'
$start = $null
$stop = $null
$service = New-Object -ComObject 'Schedule.Service'
$service.Connect()
try {
  $registered = $service.GetFolder('\').GetTask('Victoriosas-Autopilot-Synthetic-Demo')
  $task = if ($registered.Enabled -or $registered.State -in 2,4) { 'enabled' } else { 'disabled' }
  [xml]$definition = $registered.Xml
  $start = $definition.Task.Triggers.TimeTrigger.StartBoundary
  $stop = $definition.Task.Triggers.TimeTrigger.EndBoundary
} catch {
  if ($_.Exception.HResult -ne -2147024894) { throw }
}
$listener = @(Get-NetTCPConnection -State Listen | Where-Object LocalPort -eq 55439)
$process = @(Get-CimInstance Win32_Process -Filter "Name='node.exe' OR Name='postgres.exe'" |
  Where-Object { $_.CommandLine -match 'autopilot-native-host\.ts|autopilot-mission\.ts|observe-native-window|queue-fencing-20261109-pg' })
$now = [datetimeoffset]::Now
@{ observedAt=$now.ToString('o'); timeZone=(Get-TimeZone).Id; utcOffsetMinutes=$now.Offset.TotalMinutes;
  task=$task; taskStart=$start; taskStop=$stop; occupied=($listener.Count -gt 0 -or $process.Count -gt 0); probeOk=$true;
  historyEnabled=(Get-WinEvent -ListLog 'Microsoft-Windows-TaskScheduler/Operational').IsEnabled } | ConvertTo-Json -Compress
`;

async function probe(): Promise<Probe> {
  try {
    if (process.platform !== 'win32') throw Error('windows_required');
    const encoded = Buffer.from(hostQuery, 'utf16le').toString('base64');
    const result = await exec(ps, ['-NoProfile','-NonInteractive','-EncodedCommand',encoded], { timeout: 15000, windowsHide: true });
    return JSON.parse(result.stdout);
  } catch {
    return { observedAt:'', timeZone:'', utcOffsetMinutes:0, task:'absent', occupied:true, probeOk:false, historyEnabled:false };
  }
}

function localPath(value: string) {
  return /^[a-z]:[\\/]/i.test(value) && path.isAbsolute(value);
}

async function prepare(stateFile: string, state: Continuity, window: TestWindow & { proposalDirectory?: string }, host: Probe) {
  if (state.consumedMissions?.includes(nativeMission)) throw Error('fresh_mission_identity_required');
  if (classify(window, host) !== 'BEFORE_WINDOW') throw Error('preparation_requires_future_window');
  if (host.task === 'disabled' && !state.windows.some(known => known.firstTrigger === host.taskStart && known.stopsAt === host.taskStop)) {
    throw Error('unknown_registered_task_reservation');
  }
  const { checkout, verifiedSha, psqlPath } = state;
  await canonical(checkout, true);
  await canonical(psqlPath);
  if (isInside(checkout,stateFile) || !shaPattern.test(verifiedSha)) throw Error('invalid_approved_checkout');
  const git = async (args: string[]) => (await exec('git', args, { cwd: checkout, timeout: 10000 })).stdout.trim();
  if (await git(['rev-parse','HEAD']) !== verifiedSha || await git(['status','--porcelain'])) throw Error('unapproved_checkout');
  const proposalDirectory = window.proposalDirectory ?? path.join(path.dirname(stateFile), 'proposal-' + window.opensAt.slice(0,10));
  if (!localPath(proposalDirectory) || isInside(checkout,proposalDirectory)) throw Error('unsafe_proposal_directory');
  let exists = true;
  try { await lstat(proposalDirectory); } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    exists = false;
  }
  if (!exists) {
    const current = await probe();
    if (!current.probeOk || current.occupied || current.task === 'enabled' || classify(window,current) !== 'BEFORE_WINDOW') {
      throw Error('preparation_precheck_changed');
    }
    await exec(ps, ['-NoProfile','-NonInteractive','-File',path.join(checkout,'tools/native-host/Prepare-NativeDemo.ps1'),
      '-ApprovedSha',verifiedSha,'-OutputDirectory',proposalDirectory,'-StartAt',window.firstTrigger,
      '-EndAt',window.stopsAt,'-PsqlPath',psqlPath], { timeout: 25000, windowsHide: true });
  }
  await canonical(proposalDirectory,true);
  const manifest = await readManifest(path.join(proposalDirectory,'manifest.json'));
  const expectedConfig = path.join(proposalDirectory,'execution-host.json');
  const taskFile = path.join(proposalDirectory,'task.disabled.xml');
  await canonical(expectedConfig);
  await canonical(taskFile);
  const requestFile = path.join(proposalDirectory,'mission-request.json');
  await canonical(requestFile);
  const requestBytes = await readFile(requestFile);
  const request = JSON.parse(requestBytes.toString('utf8'));
  const config = await readFile(expectedConfig);
  const approvedConfig = await readFile(path.join(checkout,'tools/native-host/execution-host.json'));
  const approvedRequest = await readFile(path.join(checkout,'tools/native-host/mission-request.json'));
  const xml = await readFile(taskFile,'utf8');
  const diagnostics = path.join(proposalDirectory,'diagnostics');
  const evidence = path.join(proposalDirectory,'evidence');
  await canonical(evidence,true);
  await canonical(diagnostics,true);
  if (manifest.approvedSha !== verifiedSha || path.relative(checkout,manifest.checkout)
      || path.relative(expectedConfig,manifest.executionConfig) || path.relative(evidence,manifest.evidenceDirectory)
      || path.relative(psqlPath,manifest.psql) || manifest.missionId !== nativeMission || request.id !== nativeMission
      || !config.equals(approvedConfig) || !requestBytes.equals(approvedRequest)
      || manifest.taskName !== nativeTask || createHash('sha256').update(config).digest('hex') !== manifest.configSha256
      || !xml.includes('<Enabled>false</Enabled>') || !xml.includes('<MultipleInstancesPolicy>IgnoreNew</MultipleInstancesPolicy>')
      || !xml.includes('<StartWhenAvailable>false</StartWhenAvailable>') || !xml.includes('<Interval>PT2M</Interval>')
      || !xml.includes('<LogonType>InteractiveToken</LogonType>') || !xml.includes('<RunLevel>LeastPrivilege</RunLevel>')
      || !xml.includes('<WakeToRun>false</WakeToRun>') || !xml.includes('<ExecutionTimeLimit>PT2M</ExecutionTimeLimit>')
      || !xml.includes('<StartBoundary>'+window.firstTrigger+'</StartBoundary>')
      || !xml.includes('<EndBoundary>'+window.stopsAt+'</EndBoundary>')) {
    throw Error('prepared_proposal_integrity_failed');
  }
  return { ...window, proposalDirectory, status: 'PREPARED' as const };
}

async function main() {
  const [action, file, retryFile, ...extra] = process.argv.slice(2);
  if (!['check','propose','prepare'].includes(action) || !file || !localPath(file) || extra.length
      || (retryFile && (action !== 'propose' || !localPath(retryFile)))) throw Error('invalid_window_manager_arguments');
  const stateFile = await realpath(file);
  await canonical(stateFile);
  const lockFile = stateFile + '.lock';
  const lock = await open(lockFile,'wx',0o600);
  try {
    const state: Continuity = JSON.parse(await readFile(stateFile,'utf8'));
    if (state.version !== 1 || !localPath(state.checkout) || !localPath(state.psqlPath)
        || (state.consumedMissions !== undefined && (!Array.isArray(state.consumedMissions)
          || state.consumedMissions.some(id => typeof id !== 'string' || !/^synthetic-[a-z0-9-]{1,60}$/.test(id))))
        || !shaPattern.test(state.verifiedSha) || !Array.isArray(state.windows) || isInside(state.checkout,stateFile)) {
      throw Error('invalid_continuity_state');
    }
    const host = await probe();
    const retry: RetryEvidence | undefined = retryFile ? JSON.parse(await readFile(retryFile,'utf8')) : undefined;
    const selection = nextWindow(state.windows,host,retry);
    let updated: TestWindow | undefined;
    if (action === 'propose' && selection.kind === 'proposed') {
      state.windows.push(selection.window);
      updated = selection.window;
    } else if (action === 'prepare' && selection.kind === 'selected') {
      const index = state.windows.findIndex(window => window.opensAt === selection.window.opensAt);
      state.windows[index] = await prepare(stateFile,state,state.windows[index],host);
      updated = state.windows[index];
    }
    if (updated) {
      const temporary = stateFile + '.' + randomUUID() + '.tmp';
      await writeFile(temporary,JSON.stringify(state,null,2)+'\n',{ flag:'wx', mode:0o600, flush:true });
      try { await rename(temporary,stateFile); } finally { await unlink(temporary).catch(() => {}); }
    }
    console.log(JSON.stringify({ manager:windowManager, action, host, selection: updated ? { kind:selection.kind, window:updated } : selection,
      windows:state.windows.map(window => ({ ...validateWindow(window), temporalStatus:classify(window,host) })) },null,2));
    if (selection.kind === 'blocked' && action !== 'check') process.exitCode = 2;
  } finally {
    await lock.close();
    await unlink(lockFile);
  }
}

main().catch(error => {
  const code = error instanceof Error && /^[a-z_]{3,64}$/.test(error.message) ? error.message : 'window_manager_rejected';
  console.error(JSON.stringify({ manager:windowManager, code }));
  process.exitCode = 2;
});
