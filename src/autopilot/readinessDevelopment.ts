import path from 'node:path';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import ts from 'typescript';
import { FileAccessController, digest } from './developmentAccess';
import { DevelopmentLedger } from './selfDevelopment';
import { ManagedProcesses } from './managedProcesses';
import { PersistentMissionOrchestrator } from './missionRuntime';
import type { ExecutorAdapter, ExecutorContext, ExecutorResult, MissionSpecification } from './executorAdapter';

export const READINESS_FILE = 'src/storefront/consultationReadiness.ts';
export const READINESS_REGRESSION = 'src/storefront/consultationReadinessStrict.test.ts';
const originalHash = 'dcc6cbd6abc756d4002a114f275d14bcadf0faa7fa54f5eb982ebf18b9e7e588';
const gates = ['enabled', 'configured', 'notificationReady'] as const;
const reasons = ['disabled', 'configuration_incomplete', 'notification_unavailable'];
const normalize = (source: string) => source.replace(/\r\n/g, '\n');
/** Recognizes only the reviewed real module and its three permitted substitutions.
 * No arbitrary TypeScript, dependency imports or repository scripts are executed.
 */
export function readinessObservation(source: string) {
  const text = normalize(source);
  let baseline = text;
  const strict = gates.map(gate => text.includes(`if (deps.${gate}() !== true)`));
  for (const gate of gates) baseline = baseline.replace(`if (deps.${gate}() !== true)`, `if (!deps.${gate}())`);
  if (digest(baseline) !== originalHash) throw Error('unreviewed_source');
  return { strict, missing: gates.filter((_, i) => !strict[i]), sourceHash: digest(text) };
}
export function deriveReadinessRepair(source: string) {
  const observed = readinessObservation(source);
  let next = source;
  for (const gate of observed.missing) next = next.replace(`if (!deps.${gate}())`, `if (deps.${gate}() !== true)`);
  return next;
}
export const readinessRegression = `import test from 'node:test';
import assert from 'node:assert/strict';
import { checkConsultationReadiness } from './consultationReadiness';
test('readiness requires explicit true for every local gate', async () => {
  const healthy = { enabled: () => true, configured: () => true, notificationReady: () => true, storageReady: async () => true };
  for (const gate of ['enabled', 'configured', 'notificationReady']) {
    let reads = 0;
    const deps = { ...healthy, [gate]: () => 'false', storageReady: async () => { reads++; return true; } };
    assert.equal((await checkConsultationReadiness(deps as unknown as Parameters<typeof checkConsultationReadiness>[0])).enabled, false);
    assert.equal(reads, 0);
  }
  assert.deepEqual(await checkConsultationReadiness(healthy), { enabled: true, unavailableReason: null });
});
`;

/** External corpus: not read from the candidate and not writable by the executor. */
export async function probeReadiness(source: string, processes: ManagedProcesses, signal?: AbortSignal) {
  readinessObservation(source); // Exact reviewed variants only, BEFORE transpiling/executing.
  const js = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
  const program = `${js.replace(/export /g, '')}
    const healthy={enabled:()=>true,configured:()=>true,notificationReady:()=>true,storageReady:async()=>true};
    const violations=[];
    const gates=${JSON.stringify(gates)}, reasons=${JSON.stringify(reasons)};
    for(const [index,gate] of gates.entries()) for(const [n,value] of [false,'false','true',1,{},[],null,undefined,NaN].entries()) {
      let calls=0; const result=await checkConsultationReadiness({...healthy,[gate]:()=>value,storageReady:async()=>{calls++;return true;}},20);
      if(result.enabled!==false || result.unavailableReason!==reasons[index] || calls!==0) violations.push(gate+':'+n);
    }
    const good=await checkConsultationReadiness(healthy,20);
    if(good.enabled!==true || good.unavailableReason!==null) violations.push('valid_regression');
    const unavailable=await checkConsultationReadiness({...healthy,storageReady:async()=>false},20);
    if(unavailable.unavailableReason!=='storage_unavailable') violations.push('storage_regression');
    let aborted=false;
    const timed=await checkConsultationReadiness({...healthy,storageReady:async s=>{s.addEventListener('abort',()=>aborted=true);return new Promise(()=>{});}},10);
    if(!aborted || timed.unavailableReason!=='storage_timeout') violations.push('timeout_regression');
    console.log(JSON.stringify({violations,cases:30}));`;
  const result = await processes.exec(process.execPath, ['--input-type=module', '-e', program], { timeout: 3000, signal, operation: 'readiness_external_oracle' });
  const evidence = JSON.parse(result.stdout);
  if (evidence.cases !== 30 || !Array.isArray(evidence.violations) || evidence.violations.some((v: unknown) => typeof v !== 'string' || v.length > 40)) throw Error('invalid_oracle');
  return evidence as { violations: string[]; cases: number };
}
const actions = ['isolate', 'repair', 'verify', 'commit'] as const;
function missionFor(observed: ReturnType<typeof readinessObservation>): MissionSpecification {
  return { missionId: 'selfdev-f1-readiness', goal: 'Require explicit boolean readiness without changing valid F1 behavior', goalVersion: 1, planVersion: 1,
    plan: actions.map((id, i) => ({ id, task: `readiness.${id}`, depends_on: i ? [actions[i - 1]] : [] })),
    restrictions: ['reviewed_source_only', 'no_network', 'no_repository_scripts', 'no_publish', `observed:${observed.sourceHash}`],
    completionCriteria: ['invalid_gates_closed_before_storage', 'valid_contract_preserved', 'external_corpus_passed'] };
}
async function exists(file: string) { try { await lstat(file); return true; } catch (e) { if ((e as NodeJS.ErrnoException).code === 'ENOENT') return false; throw e; } }
export interface ReadinessHost { repository: string; baseSha: string; root: string }

/** A host-scoped adapter; payloads cannot choose commands, files, repositories or credentials. */
class ReadinessDevelopmentExecutor implements ExecutorAdapter {
  readonly executorId = 'readiness-development-v1';
  readonly branch: string;
  readonly candidate: string;
  #files: FileAccessController;
  constructor(private readonly host: ReadinessHost, private readonly original: string, private readonly ledger: DevelopmentLedger,
    private readonly processes: ManagedProcesses, private readonly afterEffect?: () => Promise<void>) {
    this.candidate = path.join(host.root, 'candidate');
    this.branch = `codex/readiness-${digest(host.root).slice(0, 12)}`;
    this.#files = new FileAccessController('selfdev-f1-readiness', [{ root: this.candidate, write: true }]);
  }
  async git(args: string[], cwd = this.host.repository, signal?: AbortSignal) {
    return (await this.processes.exec('git', ['-c', `core.hooksPath=${path.join(this.host.root, 'hooks')}`,
      '-c', 'core.fsmonitor=false', '-c', 'commit.gpgsign=false', '-c', 'core.autocrlf=false', ...args],
    { cwd, timeout: 5000, signal, operation: 'readiness_git' })).stdout.trim();
  }
  async execute(context: ExecutorContext, signal?: AbortSignal): Promise<ExecutorResult> {
    await this.ledger.assertOwner(); signal?.throwIfAborted();
    if (JSON.stringify(context.mission) !== JSON.stringify(missionFor(readinessObservation(this.original)))
      || JSON.stringify(context.permissions) !== '["development_lab"]') throw Error('authorization_changed');
    const step = context.checkpoint.current_step_id;
    if (!actions.includes(step as typeof actions[number])) throw Error('invalid_step');
    if (step === 'isolate' && !await exists(this.candidate)) await this.git(['worktree', 'add', '-b', this.branch, this.candidate, this.host.baseSha], undefined, signal);
    if ((await lstat(this.candidate)).isSymbolicLink() || await realpath(this.candidate) !== this.candidate
      || await this.git(['branch', '--show-current'], this.candidate, signal) !== this.branch
      || await this.git(['rev-parse', '--path-format=absolute', '--git-common-dir'], this.candidate, signal)
        !== await this.git(['rev-parse', '--path-format=absolute', '--git-common-dir'], undefined, signal)) throw Error('worktree_mismatch');
    const repaired = deriveReadinessRepair(this.original);
    const targets = [[READINESS_FILE, this.original, repaired], [READINESS_REGRESSION, null, readinessRegression]] as const;
    let summary = 'isolated_real_repository';
    if (step === 'repair') {
      // Check ALL prerequisites before a write; unknown concurrent work is never overwritten.
      for (const [file, before, after] of targets) {
        const current = await this.#files.read(this.candidate, file);
        if (current !== before && current !== after) throw Error('concurrent_edit');
      }
      let writes = 0;
      for (const [file, before, after] of targets) {
        await this.ledger.assertOwner(); signal?.throwIfAborted();
        if (await this.#files.read(this.candidate, file) !== after) { await this.#files.replace(this.candidate, file, before, after); writes++; }
      }
      summary = writes ? 'strict_gates_written' : 'strict_gates_reconciled';
      await this.afterEffect?.();
    }
    if (step === 'verify' || step === 'commit') {
      for (const [file, , after] of targets) if (await this.#files.read(this.candidate, file) !== after) throw Error('candidate_changed');
      const evidence = await probeReadiness(repaired, this.processes, signal);
      if (evidence.violations.length) throw Error('external_verification_failed');
      const changed = await this.git(['diff', '--name-only', this.host.baseSha], this.candidate, signal);
      const untracked = await this.git(['ls-files', '--others', '--exclude-standard'], this.candidate, signal);
      if ([...changed.split('\n'), ...untracked.split('\n')].filter(Boolean).some(p => !targets.some(([f]) => f === p))) throw Error('unexpected_changes');
      summary = `external_corpus_passed:${evidence.cases}`;
    }
    if (step === 'commit') {
      const head = await this.git(['rev-parse', 'HEAD'], this.candidate, signal);
      if (head === this.host.baseSha) {
        await this.git(['add', '--', READINESS_FILE, READINESS_REGRESSION], this.candidate, signal);
        await this.git(['-c', 'user.name=Autopilot supervised development', '-c', 'user.email=synthetic@example.invalid', 'commit', '-m', 'fix: require explicit readiness gates for consultations'], this.candidate, signal);
      } else if (await this.git(['rev-parse', 'HEAD^'], this.candidate, signal) !== this.host.baseSha
        || await this.git(['status', '--porcelain'], this.candidate, signal)) throw Error('unexpected_commit');
      summary = `commit:${await this.git(['rev-parse', 'HEAD'], this.candidate, signal)}`;
    }
    const completed = [...context.checkpoint.completed_steps, step!]; const pending = actions.filter(s => !completed.includes(s));
    return { checkpoint: { mission_state: pending.length ? 'in_progress' : 'ready_to_complete', current_step_id: pending[0] ?? null,
      completed_steps: completed, pending_steps: pending, results: [...context.checkpoint.results, { step_id: step!, status: 'passed', summary }],
      artifacts: [READINESS_FILE, READINESS_REGRESSION], test_evidence: [...context.checkpoint.test_evidence, summary],
      worktree: { branch: this.branch, sha: this.host.baseSha } }, events: [{ type: 'progress', stepId: step!, summary }], evidence: [summary] };
  }
}

export async function runReadinessDevelopment(config: ReadinessHost, options: { signal?: AbortSignal; afterEffect?: () => Promise<void> } = {}) {
  const host = structuredClone(config);
  if (Object.keys(host).sort().join(',') !== 'baseSha,repository,root' || !/^[a-f0-9]{40}$/.test(host.baseSha)
    || !path.isAbsolute(host.repository) || !path.isAbsolute(host.root)) throw Error('unauthorized_host');
  host.repository = path.resolve(host.repository); host.root = path.resolve(host.root);
  const relative = path.relative(host.repository, host.root);
  if (!relative || (!relative.startsWith('..' + path.sep) && !path.isAbsolute(relative))) throw Error('lab_must_be_external');
  const signal = options.signal ? AbortSignal.any([options.signal, AbortSignal.timeout(45000)]) : AbortSignal.timeout(45000);
  signal.throwIfAborted();
  if (!await exists(host.root)) await mkdir(host.root);
  for (const location of [host.repository, host.root]) if ((await lstat(location)).isSymbolicLink() || await realpath(location) !== location) throw Error('unsafe_host_resource');
  const ledger = new DevelopmentLedger(host.root); await ledger.acquire();
  const processes = new ManagedProcesses();
  try {
    if (!await exists(path.join(host.root, 'host.json')) && (await readdir(host.root)).some(f => f !== 'owner.json')) throw Error('lab_not_empty');
    const hooks = path.join(host.root, 'hooks');
    if (!await exists(hooks)) await mkdir(hooks);
    if ((await lstat(hooks)).isSymbolicLink() || (await readdir(hooks)).length) throw Error('unsafe_hooks');
    const reader = new ReadinessDevelopmentExecutor(host, '', ledger, processes);
    if (await reader.git(['rev-parse', 'HEAD'], undefined, signal) !== host.baseSha
      || await reader.git(['status', '--porcelain', '--untracked-files=no'], undefined, signal)) throw Error('approved_checkout_changed');
    const original = (await reader.git(['show', `${host.baseSha}:${READINESS_FILE}`], undefined, signal)) + '\n';
    const observed = readinessObservation(original);
    const fingerprint = digest((await Promise.all(['readinessDevelopment.ts', 'selfDevelopment.ts', 'developmentAccess.ts', 'missionRuntime.ts', 'managedProcesses.ts']
      .map(f => readFile(new URL(f, import.meta.url), 'utf8')))).join('\n'));
    const binding = JSON.stringify({ ...host, originalHash: observed.sourceHash, supervisorHash: fingerprint });
    const manifest = path.join(host.root, 'host.json');
    if (await exists(manifest)) {
      const info = await lstat(manifest);
      if (!info.isFile() || info.isSymbolicLink() || info.nlink !== 1 || info.size > 8192 || await readFile(manifest, 'utf8') !== binding) throw Error('host_binding_changed');
    } else {
      if ((await readdir(host.root)).some(f => !['hooks', 'owner.json'].includes(f))) throw Error('lab_not_empty');
      await writeFile(manifest, binding, { flag: 'wx' });
    }
    const baseline = await probeReadiness(original, processes, signal);
    if (!observed.missing.length) return { state: 'no_change', baseline };
    if (!baseline.violations.length) throw Error('deficiency_not_reproduced');
    await ledger.admit(missionFor(observed));
    const executor = new ReadinessDevelopmentExecutor(host, original, ledger, processes, options.afterEffect);
    await new PersistentMissionOrchestrator(ledger, 45000).runMission(executor, 'software', signal);
    return { state: ledger.snapshot!.context.checkpoint.mission_state, baseline, result: ledger.snapshot!, candidate: executor.candidate };
  } finally { await processes.close(); await ledger.release(); }
}
