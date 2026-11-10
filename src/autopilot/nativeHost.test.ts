import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, readFile, readdir, realpath, rm, writeFile, mkdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { manifest, disposition, nativeMission, nativeTask, nativeOriginRejection } from './nativeHost';
import { ManagedProcesses } from './managedProcesses';
import type { LocalMissionStatus } from './localMissionStore';
const m={version:1,checkout:tmpdir(),approvedSha:'a'.repeat(40),executionConfig:path.join(tmpdir(),'host.json'),configSha256:'b'.repeat(64),
  evidenceDirectory:path.resolve(tmpdir(),'../native-evidence'),taskName:nativeTask,missionId:nativeMission,node:process.execPath,git:process.execPath,psql:process.execPath,maxDurationMs:45000};
test('native manifest rejects other missions, arbitrary commands, secrets and unbounded duration',()=>{
  assert.equal(manifest(m).missionId,nativeMission);
  for(const change of [{missionId:'synthetic-other'},{missionId:'synthetic-native-ord204g'},{node:[process.execPath,process.execPath]},{command:'echo payload'},{password:'synthetic-denied'},{approvedSha:'main'},{maxDurationMs:0},{maxDurationMs:60001},{evidenceDirectory:tmpdir()}])
    assert.throws(()=>manifest({...m,...change}));
});
test('native dispatch never reactivates terminal missions or bypasses lease, backoff and budgets',()=>{
  const state={state:'running',queueState:'queued',attempts:0,maxAttempts:3,leaseActive:false,availableAt:new Date(0).toISOString()} as LocalMissionStatus;
  assert.equal(disposition(state),'ready');
  for(const s of ['completed','blocked','cancelled']) assert.equal(disposition({...state,state:s}),'terminal');
  assert.equal(disposition({...state,queueState:'running',leaseActive:true}),'busy');
  assert.equal(disposition({...state,queueState:'failed',availableAt:new Date(Date.now()+60000).toISOString()}),'backoff');
  assert.equal(disposition({...state,queueState:'failed',attempts:3}),'attempt_budget_exhausted');
  assert.equal(disposition({...state,queueState:'running',attempts:3}),'ready');
  assert.throws(()=>disposition({...state,queueState:'unknown'}));
});
test('managed subprocess reports explicitly accepted busy exit without changing default rejection',async()=>{
  const p=new ManagedProcesses();
  try {
    const r=await p.exec(process.execPath,['-e','console.log("busy");process.exitCode=3'],{timeout:5000,operation:'busy',acceptExitCodes:[0,3]});
    assert.equal(r.exitCode,3);assert.equal(r.stdout.trim(),'busy');
    await assert.rejects(p.exec(process.execPath,['-e','process.exitCode=3'],{timeout:5000,operation:'default'}));
    assert.equal(p.size,0);
  } finally {await p.close();}
});
test('stdout observation survives a child failing after announcing its run',async()=>{
  const p=new ManagedProcesses();let seen='';
  try {
    await assert.rejects(p.exec(process.execPath,['-e','console.log("run-before-loss");setTimeout(()=>process.exit(7),30)'],
      {timeout:5000,operation:'loss',onStdout:chunk=>{seen+=chunk;}}));
    assert.match(seen,/run-before-loss/);assert.equal(p.size,0);
  } finally {await p.close();}
});

const execFileAsync = promisify(execFile);
const checkout = fileURLToPath(new URL('../../', import.meta.url));
const script = path.join(checkout, 'scripts/autopilot-native-host.ts');

test('launcher durably records independent early rejections with unique correlation and no raw inputs', async () => {
  const fixture = await mkdtemp(path.join(await realpath(tmpdir()), 'native-diagnostics-'));
  try {
    const diagnostics = path.join(fixture, 'diagnostics');
    const evidence = path.join(fixture, 'evidence');
    await mkdir(diagnostics);
    await mkdir(evidence);
    const file = path.join(fixture, 'manifest.json');
    const config = path.join(fixture, 'config.json');
    const good = {
      ...m, checkout: path.resolve(checkout), executionConfig: config, evidenceDirectory: evidence,
    };
    const run = async (args: string[], stage: string, code: string) => {
      await assert.rejects(execFileAsync(process.execPath, ['--import', 'tsx', script, '--diagnostics', diagnostics, ...args],
        { cwd: checkout, timeout: 10000 }), (error: Error & { code?: number; stderr?: string }) => {
        assert.equal(error.code, 2);
        const rejected = JSON.parse(error.stderr!);
        assert.equal(rejected.stage, stage);
        assert.equal(rejected.code, code);
        return true;
      });
    };
    const launch = (stage: string, code: string, manifestFile = file) =>
      run(['--manifest', manifestFile, '--manual'], stage, code);
    await writeFile(file, 'invalid JSON synthetic-secret-marker');
    await Promise.all([
      run(['invalid-argument'], 'arguments', 'invalid_arguments'),
      launch('manifest', 'invalid_native_manifest'),
      launch('manifest', 'invalid_native_manifest', path.join(fixture, 'missing-manifest')),
    ]);
    await writeFile(file, JSON.stringify({ ...good, checkout: path.join(fixture, 'missing-checkout') }));
    await launch('checkout_path', 'unsafe_checkout_path');
    await writeFile(file, JSON.stringify({ ...good, evidenceDirectory: path.join(fixture, 'missing-evidence') }));
    await launch('evidence_path', 'unsafe_evidence_path');
    await writeFile(file, JSON.stringify({ ...good, checkout: diagnostics }));
    await launch('launcher_checkout', 'wrong_launcher_checkout');
    await writeFile(file, JSON.stringify(good));
    await launch('config_path', 'invalid_config_file');
    await writeFile(config, 'synthetic-secret-marker');
    await writeFile(file, JSON.stringify({ ...good, psql: path.join(fixture, 'missing-binary') }));
    await launch('host_binaries', 'invalid_host_binary');
    await writeFile(file, JSON.stringify({ ...good, node: config }));
    await launch('node_identity', 'wrong_node_binary');
    await writeFile(file, JSON.stringify(good));
    await launch('config_hash', 'native_config_changed');
    const configSha256 = createHash('sha256').update('synthetic-secret-marker').digest('hex');
    await writeFile(file, '\uFEFF' + JSON.stringify({ ...good, configSha256 }));
    await launch('config_schema', 'invalid_execution_config');
    const templateConfig = JSON.parse(await readFile(path.join(checkout, 'tools/native-host/execution-host.json'), 'utf8'));
    // The checked-in host paths are Windows-specific; keep the synthetic fixture valid on Linux CI.
    const validConfig = { ...templateConfig, resources: {
      ...templateConfig.resources, repository: checkout, worktreeRoot: fixture,
    } };
    for (const [change, stage, code] of [
      [{ permissions: { admit: true, execute: true, cancel: false } }, 'config_permissions', 'execution_only_required'],
      [{ deadlineMs: 12000 }, 'config_deadline', 'native_deadline_too_short'],
      [{}, 'git_head', 'checkout_head_unavailable'],
    ] as const) {
      const bytes = JSON.stringify({ ...validConfig, ...change });
      await writeFile(config, bytes);
      await writeFile(file, JSON.stringify({ ...good, configSha256: createHash('sha256').update(bytes).digest('hex'),
        maxDurationMs: stage === 'config_deadline' ? 15000 : 45000 }));
      await launch(stage, code);
    }

    const logs = await readdir(diagnostics);
    assert.equal(logs.length, 14);
    for (const log of logs) {
      const raw = await readFile(path.join(diagnostics, log), 'utf8');
      assert.doesNotMatch(raw, /synthetic-secret-marker|invalid-argument|manifest\.json/);
      const rows = raw.trim().split('\n').map(line => JSON.parse(line));
      assert.deepEqual(rows.map(row => row.event), ['entry_started', 'entry_rejected', 'entry_closed']);
      assert.deepEqual(rows.slice(1).map(row => row.exitCode), [2, 2]);
      assert.ok(rows.every(row => log === row.invocationId + '.preflight.jsonl' && row.timestamp.endsWith('Z')));
    }
    assert.deepEqual(await readdir(evidence), []);
    await assert.rejects(execFileAsync(process.execPath, ['--import', 'tsx', script, '--diagnostics',
      path.join(fixture, 'unavailable'), '--manifest', file, '--manual'], { cwd: checkout, timeout: 10000 }),
    (error: Error & { code?: number; stderr?: string }) => {
      assert.equal(error.code, 2);
      assert.equal(JSON.parse(error.stderr!).code, 'diagnostics_unavailable');
      return true;
    });
    assert.deepEqual(await readdir(evidence), []);
  } finally {
    await rm(fixture, { recursive: true, force: true });
  }
});

test('Windows origin probe distinguishes history, query and match failures', { skip: process.platform !== 'win32' }, async () => {
  const probe = path.join(checkout, 'tools/native-host/Read-TaskOrigin.ps1');
  const event = [
    "$entry = [pscustomobject]@{ RecordId = 101; TimeCreated = Get-Date }",
    `Add-Member -InputObject $entry -MemberType ScriptMethod -Name ToXml -Value { '<Event><EventData><Data Name="TaskName">\\Victoriosas-Autopilot-Synthetic-Demo</Data><Data Name="ProcessID">456</Data></EventData></Event>' }`,
  ].join('; ');
  const cases = [
    ['[pscustomobject]@{ IsEnabled = $false }', 'throw "unexpected"', 10, 'native_history_disabled'],
    ['[pscustomobject]@{ IsEnabled = $true }', 'throw "private error"', 11, 'native_event_query_failed'],
    ['[pscustomobject]@{ IsEnabled = $true }', 'return', 12, 'native_event_missing'],
    ['[pscustomobject]@{ IsEnabled = $true }', event + '; $entry; $entry', 13, 'native_event_ambiguous'],
    ['[pscustomobject]@{ IsEnabled = $true }', event + '; $entry', 0, ''],
  ] as const;
  for (const [history, query, exitCode, code] of cases) {
    const command = `$ProgressPreference = 'SilentlyContinue'; function Get-WinEvent { param($ListLog, $FilterHashtable, $MaxEvents) if ($ListLog) { ${history}; return }; ${query} }; . '${probe.replaceAll("'", "''")}' -LauncherPid 456; exit $LASTEXITCODE`;
    const run = execFileAsync('powershell.exe', ['-NoProfile', '-NonInteractive', '-EncodedCommand',
      Buffer.from(command, 'utf16le').toString('base64')], { timeout: 10000 });
    if (exitCode === 0) {
      const origin = JSON.parse((await run).stdout);
      assert.equal(origin.recordId, 101);
      assert.equal(origin.pid, 456);
      continue;
    }
    await assert.rejects(run, (error: Error & { code?: number; stdout?: string; stderr?: string }) => {
      assert.equal(error.code, exitCode);
      assert.equal(error.stdout, '');
      assert.equal(error.stderr, '');
      assert.equal(nativeOriginRejection(exitCode), code);
      return true;
    });
  }
});
