import path from 'node:path';
import { mkdir, readFile, writeFile, readdir, lstat, unlink, realpath, rmdir, rename } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { FileAccessController, digest } from './developmentAccess';
import { ManagedProcesses } from './managedProcesses';
import { PersistentMissionOrchestrator } from './missionRuntime';
import type { ExecutorAdapter, ExecutorContext, ExecutorResult, MissionCheckpoint, MissionLedger, MissionSpecification } from './executorAdapter';

// Deliberately closed source language: no imports, calls, instructions, loops or payload commands.
export const sourceFor = (kind: 'upper' | 'lower' | 'both', limit = 10) =>
  `export function boundedCount(value) {\n  return ${kind === 'upper' ? `Math.min(value, ${limit})` : kind === 'lower' ? 'Math.max(0, value)' : `Math.max(0, Math.min(value, ${limit}))`};\n}\n`;
export function inspectSource(source: string) {
  for (let limit = 1; limit <= 100; limit++) for (const kind of ['upper', 'both'] as const)
    if (source === sourceFor(kind, limit)) return { kind, limit };
  if (source === sourceFor('lower')) return { kind: 'lower' as const, limit: 10 };
  throw Error('unsupported_source');
}
export const regressionFor = (limit: number) => `import { boundedCount } from './subject.mjs';\nimport assert from 'node:assert/strict';\nassert.equal(boundedCount(-1), 0);\nassert.equal(boundedCount(${limit + 1}), ${limit});\n`;
const steps = ['isolate', 'propose', 'reject', 'rollback', 'repair', 'verify', 'commit'] as const;
const id = 'selfdev-bounded-count';
const branch = 'codex/selfdev-bounded-count';
type Snapshot = { version: number; previous: string; hash: string; at: string; runId: string; pid: number; context: ExecutorContext; events: string[] };
const safeCode = (e: unknown) => e instanceof Error && /^[a-z_]{3,64}$/.test(e.message) ? e.message : 'development_failed';
async function absent(file: string) { try { await lstat(file); return false; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return true; throw e; } }

/** A single-mission local MissionLedger adapter, no scheduler or parallel queue.
 * Version files + exclusive process ownership. Reclaim only after owner is dead;
 * no lease-based filesystem safety claim. Unknown/live PIDs fail closed.
 */
export class DevelopmentLedger implements MissionLedger {
  #token = randomUUID();
  #snapshot!: Snapshot;
  #claimed = false;
  constructor(readonly root: string) {}
  async acquire() {
    const lock = path.join(this.root, 'owner.json');
    const guard = path.join(this.root, 'claim-guard');
    const guardMarker = path.join(guard, `guard-${this.#token}.json`);
    try { await mkdir(guard); }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw Error('busy');
      // Reclaim only an aged guard whose owner is demonstrably dead. A recent
      // or ambiguous guard is held closed; never clear another live claimant.
      try {
        const info = await lstat(guard);
        if (!info.isDirectory() || info.isSymbolicLink() || Date.now() - info.mtimeMs < 120000) throw Error('busy');
        const entries = await readdir(guard);
        if (entries.length > 1 || entries.some(name => !/^guard-[a-f0-9-]{36}\.json$/.test(name))) throw Error('busy');
        if (Date.now() - (await lstat(guard)).mtimeMs < 120000) throw Error('busy');
        if (entries.length) {
          const oldGuard = JSON.parse(await readFile(path.join(guard, entries[0]), 'utf8'));
          if (!Number.isSafeInteger(oldGuard.pid) || oldGuard.pid <= 0 || typeof oldGuard.token !== 'string') throw Error('busy');
          try { process.kill(oldGuard.pid, 0); throw Error('busy'); }
          catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ESRCH') throw Error('busy'); }
          await unlink(path.join(guard, entries[0]));
        }
        await rmdir(guard);
        await mkdir(guard);
      } catch { throw Error('busy'); }
    }
    try { await writeFile(guardMarker, JSON.stringify({ pid: process.pid, token: this.#token }), { flag: 'wx' }); }
    catch { await rmdir(guard).catch(() => {}); throw Error('busy'); }
    try {
    if (!await absent(lock)) {
      if (!(await lstat(lock)).isFile() || (await lstat(lock)).isSymbolicLink()) throw Error('invalid_owner');
      const old = JSON.parse(await readFile(lock, 'utf8'));
      if (!Number.isSafeInteger(old.pid) || old.pid <= 0) throw Error('invalid_owner');
      try { process.kill(old.pid, 0); throw Error('busy'); }
      catch (e) { if ((e as NodeJS.ErrnoException).code !== 'ESRCH') throw Error('busy'); }
      await unlink(lock);
    }
    await writeFile(lock, JSON.stringify({ pid: process.pid, token: this.#token }), { flag: 'wx' });
    } finally { await unlink(guardMarker); await rmdir(guard); }
    try {
    const files = (await readdir(this.root)).filter(x => /^state-\d{3}\.json$/.test(x)).sort();
    let previous = '';
    for (const [index, file] of files.entries()) {
      const entry = await lstat(path.join(this.root, file));
      if (!entry.isFile() || entry.isSymbolicLink() || entry.nlink !== 1 || entry.size > 1048576) throw Error('audit_corrupt');
      const s: Snapshot = JSON.parse(await readFile(path.join(this.root, file), 'utf8'));
      const { hash, ...content } = s;
      if (s.version !== index || s.previous !== previous || digest(JSON.stringify(content)) !== hash) throw Error('audit_corrupt');
      previous = hash; this.#snapshot = s;
    }
    } catch (e) { await this.release(); throw e; }
  }
  async assertOwner() {
    const owner = JSON.parse(await readFile(path.join(this.root, 'owner.json'), 'utf8'));
    if (owner.token !== this.#token || owner.pid !== process.pid) throw Error('stale_owner');
  }
  async release() { await this.assertOwner(); await unlink(path.join(this.root, 'owner.json')); }
  async save(context: ExecutorContext, event: string) {
    await this.assertOwner();
    const version = this.#snapshot ? this.#snapshot.version + 1 : 0;
    if (version > 40) throw Error('journal_budget');
    const content = { version, previous: this.#snapshot?.hash ?? '', at: new Date().toISOString(), runId: this.#token, pid: process.pid, context: structuredClone(context),
      events: [...(this.#snapshot?.events ?? []), event] };
    const snapshot = { ...content, hash: digest(JSON.stringify(content)) };
    // A killed writer may leave a partial temporary record. Never expose it
    // as a committed checkpoint; only the atomic rename publishes the version.
    const target = path.join(this.root, `state-${String(version).padStart(3, '0')}.json`);
    if (!await absent(target)) throw Error('journal_conflict');
    const pending = path.join(this.root, `pending-${this.#token}-${String(version).padStart(3, '0')}.tmp`);
    await writeFile(pending, JSON.stringify(snapshot), { flag: 'wx' });
    await this.assertOwner();
    if (!await absent(target)) throw Error('journal_conflict');
    await rename(pending, target);
    this.#snapshot = snapshot;
  }
  get snapshot() { return this.#snapshot ? structuredClone(this.#snapshot) : null; }
  async admit(mission: MissionSpecification) {
    if (this.#snapshot) return;
    await this.save({ mission, executorId: '', permissions: ['development_lab'], checkpointVersion: 0,
      checkpoint: { mission_state: 'queued', completed_steps: [], pending_steps: mission.plan.map(s => s.id), results: [], artifacts: [], test_evidence: [] } }, 'observed_deficiency');
  }
  async claimMission() {
    if (this.#claimed || !this.#snapshot || ['completed', 'blocked', 'cancelled'].includes(this.#snapshot.context.checkpoint.mission_state)) return null;
    this.#claimed = true; return structuredClone(this.#snapshot.context);
  }
  async saveCheckpoint(context: ExecutorContext, _operation: string, checkpoint: MissionCheckpoint) {
    await this.assertOwner();
    if (context.checkpointVersion !== this.#snapshot.context.checkpointVersion) return false;
    context.checkpoint = structuredClone(checkpoint); context.checkpointVersion++;
    await this.save(context, `checkpoint:${checkpoint.current_step_id ?? 'ready'}`); return true;
  }
  async completeMission(context: ExecutorContext) { context.checkpoint.mission_state = 'completed'; await this.save(context, 'completed'); }
  async failMission(context: ExecutorContext, reason: string) { context.checkpoint.mission_state = 'blocked'; context.checkpoint.last_error = reason; await this.save(context, 'blocked'); }
}

export class SelfDevelopmentObserver {
  diagnose(source: string): { mission: MissionSpecification; limit: number } | null {
    const observation = inspectSource(source);
    if (observation.kind === 'both') return null;
    if (observation.kind !== 'upper') throw Error('unsupported_deficiency');
    const mission: MissionSpecification = { missionId: id, goal: 'Keep boundedCount between zero and its declared upper bound',
      goalVersion: 1, planVersion: 1,
      plan: steps.map((s, i) => ({ id: s, task: `development.${s}`, depends_on: i ? [steps[i - 1]] : [] })),
      restrictions: ['local_synthetic_only', 'no_network', 'immutable_supervisor', 'no_publish'],
      completionCriteria: ['negative_and_upper_boundary', 'independent_oracle', 'rollback_verified'],
    };
    return { mission, limit: observation.limit };
  }
}

/** External trusted oracle; candidate regression files never determine approval.
 * Only the closed, finite expression grammar above is executed, in a bounded child.
 */
export class VerificationEngine {
  #receipts = new WeakSet<object>();
  constructor(private readonly processes: ManagedProcesses) {}
  async verify(source: string, limit: number, signal?: AbortSignal) {
    if (!Number.isInteger(limit) || limit < 1 || limit > 100) throw Error('invalid_contract');
    inspectSource(source);
    const cases = [-100, -1, 0, 1, limit - 1, limit, limit + 1, 1000];
    const script = `${source.replace('export ', '')}\nconst cases = ${JSON.stringify(cases)};\nif (!cases.every(v => boundedCount(v) === Math.max(0, Math.min(v, ${limit})))) process.exit(2);\n`;
    await this.processes.exec(process.execPath, ['--input-type=module', '-e', script], { timeout: 3000, signal, operation: 'external_oracle' });
    const receipt = Object.freeze({ sourceHash: digest(source), oracle: 'bounded-count-v1', limit });
    this.#receipts.add(receipt); return receipt;
  }
  accepts(receipt: object) { return this.#receipts.has(receipt); }
}

export class DevelopmentExecutor implements ExecutorAdapter {
  readonly executorId = 'local-self-development-v1';
  readonly workspace: string;
  #access: FileAccessController;
  #oracle: VerificationEngine;
  constructor(private readonly root: string, private readonly base: string, private readonly original: string,
    private readonly limit: number, private readonly ledger: DevelopmentLedger, private readonly processes: ManagedProcesses,
    private readonly afterEffect?: () => Promise<void>) {
    this.workspace = path.join(root, 'candidate');
    this.#access = new FileAccessController(id, [{ root: this.workspace, write: true }]);
    this.#oracle = new VerificationEngine(processes);
  }
  private async git(args: string[], cwd = path.join(this.root, 'repository'), signal?: AbortSignal) {
    return (await this.processes.exec('git', ['-c', `core.hooksPath=${path.join(this.root, 'hooks')}`, '-c', 'commit.gpgsign=false',
      '-c', 'core.fsmonitor=false', '-c', 'core.autocrlf=false', ...args], { cwd, timeout: 5000, signal, operation: 'development_git' })).stdout.trim();
  }
  private async effect(file: string, before: string | null, after: string | null) {
    await this.ledger.assertOwner();
    const current = await this.#access.read(this.workspace, file);
    if (current === after) return 'reconciled';
    await this.#access.replace(this.workspace, file, before, after); return 'written';
  }
  async execute(context: ExecutorContext, signal?: AbortSignal): Promise<ExecutorResult> {
    await this.ledger.assertOwner(); signal?.throwIfAborted();
    const expected = new SelfDevelopmentObserver().diagnose(this.original)!.mission;
    if (JSON.stringify(context.mission) !== JSON.stringify(expected) || JSON.stringify(context.permissions) !== '["development_lab"]') throw Error('authorization_changed');
    const step = context.checkpoint.current_step_id;
    if (!steps.includes(step as typeof steps[number])) throw Error('invalid_step');
    if (step === 'isolate' && await absent(this.workspace)) await this.git(['worktree', 'add', '-b', branch, this.workspace, this.base], undefined, signal);
    if ((await lstat(this.workspace)).isSymbolicLink() || await realpath(this.workspace) !== this.workspace
      || await this.git(['branch', '--show-current'], this.workspace, signal) !== branch
      || await this.git(['rev-parse', '--path-format=absolute', '--git-common-dir'], this.workspace, signal)
        !== await this.git(['rev-parse', '--path-format=absolute', '--git-common-dir'], undefined, signal)) throw Error('worktree_mismatch');
    const bad = sourceFor('lower'); const good = sourceFor('both', this.limit);
    let evidence = step!;
    if (step === 'propose') {
      evidence = await this.effect('subject.mjs', this.original, bad);
      await this.effect('regression.mjs', null, regressionFor(this.limit));
      await this.afterEffect?.(); // Host observer may interrupt, never supply a repair.
    }
    if (step === 'reject') {
      const source = await this.#access.read(this.workspace, 'subject.mjs');
      if (source !== bad) throw Error('concurrent_edit');
      let rejected = false;
      try { await this.#oracle.verify(source, this.limit, signal); } catch (e) { signal?.throwIfAborted(); if (safeCode(e) !== 'process_failed') throw e; rejected = true; }
      if (!rejected) throw Error('defective_candidate_accepted');
      evidence = 'external_oracle_rejected_upper_regression';
    }
    if (step === 'rollback') {
      await this.effect('subject.mjs', bad, this.original);
      await this.effect('regression.mjs', regressionFor(this.limit), null);
      if (await this.git(['status', '--porcelain'], this.workspace, signal)) throw Error('rollback_incomplete');
      evidence = 'baseline_restored';
    }
    if (step === 'repair') {
      await this.effect('subject.mjs', this.original, good);
      await this.effect('regression.mjs', null, regressionFor(this.limit));
      evidence = 'corrected_from_rejection';
    }
    if (step === 'verify' || step === 'commit') {
      const source = await this.#access.read(this.workspace, 'subject.mjs');
      if (source !== good || await this.#access.read(this.workspace, 'regression.mjs') !== regressionFor(this.limit)) throw Error('candidate_changed');
      const receipt = await this.#oracle.verify(source, this.limit, signal);
      if (!this.#oracle.accepts(receipt)) throw Error('verification_required');
      // Only generated, byte-checked regression runs; untrusted repository scripts never run.
      await this.processes.exec(process.execPath, ['regression.mjs'], { cwd: this.workspace, timeout: 3000, signal, operation: 'generated_regression' });
      const names = await this.git(['ls-files', '--cached', '--others', '--exclude-standard'], this.workspace, signal);
      if (names.split('\n').sort().join(',') !== 'regression.mjs,subject.mjs') throw Error('unexpected_files');
      evidence = `oracle:${receipt.sourceHash}`;
    }
    if (step === 'commit') {
      const head = await this.git(['rev-parse', 'HEAD'], this.workspace, signal);
      if (head === this.base) {
        await this.git(['add', '--', 'subject.mjs', 'regression.mjs'], this.workspace, signal);
        await this.git(['-c', 'user.name=Autopilot laboratory', '-c', 'user.email=synthetic@example.invalid', 'commit', '-m', 'fix: enforce bounded count contract'], this.workspace, signal);
      } else if (await this.git(['rev-parse', 'HEAD^'], this.workspace, signal) !== this.base
        || await this.git(['status', '--porcelain'], this.workspace, signal)) throw Error('unexpected_commit');
      evidence = `commit:${await this.git(['rev-parse', 'HEAD'], this.workspace, signal)}`;
    }
    const done = [...context.checkpoint.completed_steps, step!];
    const pending = steps.filter(s => !done.includes(s));
    return { checkpoint: { mission_state: pending.length ? 'in_progress' : 'ready_to_complete',
      current_step_id: pending[0] ?? null, completed_steps: done, pending_steps: pending,
      results: [...context.checkpoint.results, { step_id: step!, status: 'passed', summary: evidence }],
      artifacts: ['subject.mjs', 'regression.mjs'], test_evidence: [...context.checkpoint.test_evidence, evidence],
      worktree: { branch, sha: this.base } }, events: [{ type: 'progress', stepId: step!, summary: evidence }], evidence: [evidence] };
  }
}

export async function runDevelopmentLab(rootInput: string, options: { signal?: AbortSignal; afterEffect?: () => Promise<void> } = {}) {
  options = { ...options, signal: options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000) };
  options.signal?.throwIfAborted();
  const root = path.resolve(rootInput);
  const processes = new ManagedProcesses();
  // Lab root is explicitly assigned by the operator. Never initialize over existing material.
  if (await absent(root)) await mkdir(root);
  if ((await lstat(root)).isSymbolicLink() || await realpath(root) !== root) throw Error('unsafe_lab_root');
  const ledger = new DevelopmentLedger(root);
  await ledger.acquire();
  try {
    const supervisorHash = digest((await Promise.all(['selfDevelopment.ts', 'developmentAccess.ts', 'missionRuntime.ts', 'managedProcesses.ts']
      .map(file => readFile(new URL(file, import.meta.url), 'utf8')))).join('\n'));
    const repository = path.join(root, 'repository');
    const envGit = async (args: string[]) => (await processes.exec('git', ['-c', `core.hooksPath=${path.join(root, 'hooks')}`, '-c', 'core.autocrlf=false', '-c', 'commit.gpgsign=false', ...args], { cwd: repository, timeout: 5000, signal: options.signal, operation: 'lab_setup' })).stdout.trim();
    if (await absent(path.join(root, 'baseline.json'))) {
      // Bootstrap marker is created before any repository effects. An interrupted
      // bootstrap can resume, but only when every surviving artifact is verified.
      const marker = path.join(root, 'bootstrap.json');
      const expectedMarker = JSON.stringify({ kind: 'self-development-lab-v1', supervisorHash });
      if (await absent(marker)) {
        if ((await readdir(root)).some(x => x !== 'owner.json')) throw Error('lab_not_empty');
        await writeFile(marker, expectedMarker, { flag: 'wx' });
      } else if (await readFile(marker, 'utf8') !== expectedMarker) throw Error('bootstrap_changed');
      if ((await readdir(root)).some(x => !['owner.json', 'bootstrap.json', 'repository', 'hooks'].includes(x))) throw Error('lab_not_empty');
      for (const dir of [repository, path.join(root, 'hooks')]) {
        if (await absent(dir)) await mkdir(dir);
        const info = await lstat(dir);
        if (!info.isDirectory() || info.isSymbolicLink() || await realpath(dir) !== dir) throw Error('unsafe_lab_resource');
      }
      if ((await readdir(path.join(root, 'hooks'))).length) throw Error('unsafe_lab_resource');
      const entries = await readdir(repository);
      if (entries.some(entry => !['.git', 'subject.mjs'].includes(entry))) throw Error('lab_not_empty');
      const subject = path.join(repository, 'subject.mjs');
      if (await absent(subject)) await writeFile(subject, sourceFor('upper'), { flag: 'wx' });
      else {
        const info = await lstat(subject);
        if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1
          || await realpath(subject) !== subject || await readFile(subject, 'utf8') !== sourceFor('upper')) throw Error('bootstrap_changed');
      }
      const gitDir = path.join(repository, '.git');
      if (await absent(gitDir)) await envGit(['init']);
      else {
        const info = await lstat(gitDir);
        if (!info.isDirectory() || info.isSymbolicLink() || await realpath(gitDir) !== gitDir) throw Error('unsafe_lab_resource');
        if (await envGit(['rev-parse', '--show-toplevel']) !== repository.replaceAll('\\', '/')) throw Error('bootstrap_changed');
      }
      let head: string | null = null;
      try { head = await envGit(['rev-parse', '--verify', 'HEAD']); }
      catch (error) { if (safeCode(error) !== 'process_failed') throw error; }
      if (head === null) {
        await envGit(['add', 'subject.mjs']);
        await envGit(['-c', 'user.name=Autopilot laboratory', '-c', 'user.email=synthetic@example.invalid', 'commit', '-m', 'synthetic deficiency seed']);
        head = await envGit(['rev-parse', 'HEAD']);
      }
      if (await envGit(['ls-tree', '--name-only', head]) !== 'subject.mjs'
        || await envGit(['show', `${head}:subject.mjs`]) !== sourceFor('upper').trim()
        || await envGit(['status', '--porcelain'])) throw Error('bootstrap_changed');
      await writeFile(path.join(root, 'baseline.json'), JSON.stringify({ sha: head, source: sourceFor('upper'), supervisorHash }), { flag: 'wx' });
    }
    for (const resource of ['repository', 'hooks', 'baseline.json']) {
      const location = path.join(root, resource); const info = await lstat(location);
      if (info.isSymbolicLink() || (info.isFile() && (info.nlink !== 1 || info.size > 8192)) || await realpath(location) !== location) throw Error('unsafe_lab_resource');
    }
    const baseline = JSON.parse(await readFile(path.join(root, 'baseline.json'), 'utf8'));
    if (baseline.supervisorHash !== supervisorHash) throw Error('supervisor_changed');
    if (!/^[a-f0-9]{40}$/.test(baseline.sha) || inspectSource(baseline.source).kind !== 'upper'
      || await envGit(['show', `${baseline.sha}:subject.mjs`]) !== baseline.source.trim()
      || await envGit(['ls-tree', '--name-only', baseline.sha]) !== 'subject.mjs'
      || (await readdir(path.join(root, 'hooks'))).length) throw Error('baseline_changed');
    const finding = new SelfDevelopmentObserver().diagnose(baseline.source)!;
    if (!ledger.snapshot) {
      let failing = false;
      try { await new VerificationEngine(processes).verify(baseline.source, finding.limit, options.signal); }
      catch (e) { options.signal?.throwIfAborted(); if (safeCode(e) !== 'process_failed') throw e; failing = true; }
      if (!failing) throw Error('deficiency_not_reproduced');
    }
    await ledger.admit(finding.mission);
    const executor = new DevelopmentExecutor(root, baseline.sha, baseline.source, finding.limit, ledger, processes, options.afterEffect);
    await new PersistentMissionOrchestrator(ledger, 45000).runMission(executor, 'software', options.signal);
    const result = ledger.snapshot!;
    if (result.context.checkpoint.mission_state === 'completed') {
      const body = `# Proposed synthetic repair\n\nMission: ${id}\nBase: ${baseline.sha}\n${result.context.checkpoint.test_evidence.join('\n')}\n\nLocal commit only. No remote repository, push, merge or deployment.\n`;
      const proposal = path.join(root, 'PR.md');
      if (await absent(proposal)) await writeFile(proposal, body, { flag: 'wx' });
      else if (await readFile(proposal, 'utf8') !== body) throw Error('proposal_conflict');
    }
    return result;
  } finally { await processes.close(); await ledger.release(); }
}
