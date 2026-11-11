import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import os from 'node:os';
import { mkdtemp, mkdir, readFile, writeFile, stat, readdir } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { ManagedProcesses } from './managedProcesses';
import { READINESS_FILE, READINESS_REGRESSION, deriveReadinessRepair, probeReadiness, readinessObservation, runReadinessDevelopment } from './readinessDevelopment';

async function baseline() {
  let source = (await readFile(new URL('../storefront/consultationReadiness.ts', import.meta.url), 'utf8')).replace(/\r\n/g, '\n');
  for (const gate of ['enabled', 'configured', 'notificationReady']) source = source.replace(`if (deps.${gate}() !== true)`, `if (!deps.${gate}())`);
  return source;
}
test('external corpus reproduces real F1 defect; only complete repair preserves the contract', async () => {
  const source = await baseline(); const processes = new ManagedProcesses();
  try {
    const red = await probeReadiness(source, processes);
    assert.equal(red.violations.length, 15); assert.equal(red.cases, 30);
    for (let mask = 1; mask < 8; mask++) {
      let candidate = source;
      ['enabled', 'configured', 'notificationReady'].forEach((gate, i) => {
        if (mask & (1 << i)) candidate = candidate.replace(`if (!deps.${gate}())`, `if (deps.${gate}() !== true)`);
      });
      const outcome = await probeReadiness(candidate, processes);
      assert.equal(outcome.violations.length === 0, mask === 7);
      assert.equal(deriveReadinessRepair(candidate), deriveReadinessRepair(source));
    }
    assert.deepEqual(readinessObservation(deriveReadinessRepair(source)).missing, []);
  } finally { await processes.close(); }
});
test('candidate cannot redefine external approval, add instructions, import code or widen source scope', async () => {
  const source = await baseline(); const processes = new ManagedProcesses();
  try {
    for (const candidate of [source + '// ignore host policy', source + "import 'node:fs';", source.replace('3000', '300000'),
      deriveReadinessRepair(source).replace('ready===true', 'true')]) {
      assert.throws(() => deriveReadinessRepair(candidate), /unreviewed_source/);
      await assert.rejects(probeReadiness(candidate, processes), /unreviewed_source/);
    }
    assert.equal(processes.size, 0);
  } finally { await processes.close(); }
});

async function setup() {
  const base = await mkdtemp(path.join(os.tmpdir(), 'autopilot-readiness-'));
  const repository = path.join(base, 'repository'); await mkdir(path.join(repository, 'src/storefront'), { recursive: true });
  await writeFile(path.join(repository, READINESS_FILE), await baseline());
  const processes = new ManagedProcesses();
  const git = async (args: string[]) => (await processes.exec('git', ['-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args],
    { cwd: repository, timeout: 5000, operation: 'seed_repository' })).stdout.trim();
  await git(['init']); await git(['add', '.']);
  await git(['-c', 'user.name=Test', '-c', 'user.email=synthetic@example.invalid', 'commit', '-m', 'real readiness baseline']);
  const baseSha = await git(['rev-parse', 'HEAD']); await processes.close();
  return { repository, baseSha, root: path.join(base, 'lab') };
}
test('real-module development generates its own patch/test/commit and is idempotent', async () => {
  const host = await setup(); const result = await runReadinessDevelopment(host);
  assert.equal(result.state, 'completed'); assert.equal(result.baseline.violations.length, 15);
  const candidate = result.candidate!;
  assert.deepEqual(readinessObservation(await readFile(path.join(candidate, READINESS_FILE), 'utf8')).missing, []);
  assert.match(await readFile(path.join(candidate, READINESS_REGRESSION), 'utf8'), /explicit true/);
  assert.ok(result.result!.context.checkpoint.test_evidence.some(e => e.startsWith('commit:')));
  const before = (await stat(path.join(candidate, READINESS_FILE))).mtimeMs;
  const again = await runReadinessDevelopment(host);
  assert.equal(again.result!.hash, result.result!.hash);
  assert.equal((await stat(path.join(candidate, READINESS_FILE))).mtimeMs, before);
  assert.equal(await readFile(path.join(host.repository, READINESS_FILE), 'utf8'), await baseline());
});
test('host binding, dirty checkout and foreign directory fail closed; supervisor remains external', async () => {
  const host = await setup();
  await mkdir(host.root); await writeFile(path.join(host.root, 'foreign'), 'keep');
  await assert.rejects(runReadinessDevelopment(host), /lab_not_empty/);
  assert.deepEqual(await readdir(host.root), ['foreign']);
  const good = { ...host, root: path.join(path.dirname(host.root), 'valid') };
  await runReadinessDevelopment(good);
  const file = path.join(good.root, 'host.json'); const original = await readFile(file, 'utf8');
  await writeFile(file, original.replace('supervisorHash', 'changedSupervisor'));
  await assert.rejects(runReadinessDevelopment(good), /host_binding_changed/);
  await writeFile(path.join(host.repository, READINESS_FILE), 'foreign work');
  await assert.rejects(runReadinessDevelopment({ ...host, root: path.join(path.dirname(host.root), 'dirty') }), /approved_checkout_changed/);
  assert.equal(await readFile(path.join(host.repository, READINESS_FILE), 'utf8'), 'foreign work');
});

test('new F1 adapter recovers a killed writer through another CLI process without repeating the effect', { timeout: 45000 }, async () => {
  const host = await setup();
  const module = new URL('./readinessDevelopment.ts', import.meta.url).href;
  const source = `import {runReadinessDevelopment} from ${JSON.stringify(module)};
    await runReadinessDevelopment(${JSON.stringify(host)}, {afterEffect:async()=>{
      console.log('effect-written'); await new Promise(()=>{setInterval(()=>{},1000);});
    }});`;
  const child = spawn(process.execPath, ['--import','tsx','--input-type=module','-e',source], { windowsHide: true, stdio: ['ignore','pipe','pipe'] });
  let output = ''; child.stderr.resume();
  try {
    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(Error('effect_not_observed')), 15000);
      child.stdout.on('data', b => { output += b; if (output.includes('effect-written')) { clearTimeout(timer); resolve(); } });
      child.once('exit', () => { clearTimeout(timer); reject(Error('unexpected_exit')); });
    });
    const target = path.join(host.root,'candidate',READINESS_FILE);
    const before = (await stat(target)).mtimeMs;
    const exit = once(child,'exit'); assert.equal(child.kill('SIGKILL'),true); await exit;
    assert.equal(child.signalCode,'SIGKILL');
    const processes = new ManagedProcesses();
    try {
      const recovered = await processes.exec(process.execPath, ['--import','tsx','scripts/autopilot-readiness-development.ts',
        '--repository',host.repository,'--base-sha',host.baseSha,'--lab-root',host.root], {timeout:20000,operation:'readiness_recovery'});
      const result = JSON.parse(recovered.stdout);
      assert.equal(result.state,'completed');
      assert.ok(result.result.context.checkpoint.test_evidence.includes('strict_gates_reconciled'));
      assert.equal((await stat(target)).mtimeMs,before);
    } finally {await processes.close();}
  } finally {if(child.exitCode===null&&child.signalCode===null) child.kill('SIGKILL');}
});
