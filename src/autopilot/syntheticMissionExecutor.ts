import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExecutorAdapter, ExecutorContext, ExecutorResult, MissionPlanStep } from './executorAdapter';
import { authorizedObjective, SYNTHETIC_RESTRICTIONS, type SyntheticObservation } from './missionPlanner';
import type { ManagedProcesses } from './managedProcesses';

const exec = promisify(execFile);
export const SYNTHETIC_GOAL = 'Verify synthetic mission recovery';
export const SYNTHETIC_SEED = 'Autopilot disposable synthetic repository v1\n';
export const SYNTHETIC_PLAN: MissionPlanStep[] = [
  { id: 'prepare', task: 'synthetic.prepare', depends_on: [] },
  { id: 'modify', task: 'synthetic.modify', depends_on: ['prepare'] },
  { id: 'verify', task: 'synthetic.verify', depends_on: ['modify'] },
];
export const SYNTHETIC_CONTENTS = 'Autopilot completed the authorized synthetic change.\n';
export const SYNTHETIC_TEST_SOURCE = `const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('authorized synthetic change', () => assert.equal(fs.readFileSync(__dirname + '/result.txt', 'utf8'), ${JSON.stringify(SYNTHETIC_CONTENTS)}));
`;
async function exists(location: string) {
  try { return await lstat(location); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
/** Fixed-purpose local adapter. No shell, network, model, repository scripts or arbitrary file paths. */
export class SyntheticMissionExecutor implements ExecutorAdapter {
  constructor(readonly executorId: string, private readonly repo: string, private readonly root: string, private readonly baseSha: string,
    private readonly processes?: ManagedProcesses) {}
  private authorize(context: ExecutorContext, executing: boolean) {
    const mission = context.mission;
    if (!context.permissions.includes('synthetic_worktree') || mission.goal !== SYNTHETIC_GOAL
      || mission.goalVersion !== 1
      || JSON.stringify(mission.restrictions) !== JSON.stringify(SYNTHETIC_RESTRICTIONS)
      || !/^synthetic-[a-z0-9-]{1,60}$/.test(mission.missionId)
      || !/^[a-f0-9]{40}$/.test(this.baseSha)) throw Error('synthetic_authorization_required');
    if (mission.objective !== undefined) {
      const objective = authorizedObjective(mission.objective);
      if (JSON.stringify(mission.completionCriteria) !== JSON.stringify(objective.acceptance)) throw Error('synthetic_authorization_required');
      if (executing && (mission.planVersion < 1 || mission.planVersion > objective.limits.maxReplans + 1
        || mission.plan.length > objective.limits.maxSteps
        || JSON.stringify(mission.planHistory?.at(-1)?.steps) !== JSON.stringify(mission.plan)
        || mission.plan.some(s => !['synthetic.prepare', 'synthetic.modify', 'synthetic.verify'].includes(s.task)))) throw Error('synthetic_authorization_required');
    } else if (mission.planVersion !== 1 || JSON.stringify(mission.plan) !== JSON.stringify(SYNTHETIC_PLAN)
      || JSON.stringify(mission.completionCriteria) !== JSON.stringify(['synthetic_test_passed'])) throw Error('synthetic_authorization_required');
  }
  private async workspace(context: ExecutorContext, create: boolean, signal?: AbortSignal) {
    signal?.throwIfAborted();
    const mission = context.mission;
    const rootInfo = await exists(this.root);
    if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink() || await realpath(this.root) !== path.resolve(this.root)) throw Error('unsafe_workspace_root');
    const hooks = path.join(this.root, 'empty-hooks');
    if (!await exists(hooks)) await mkdir(hooks);
    if ((await lstat(hooks)).isSymbolicLink() || (await readdir(hooks)).length) throw Error('unsafe_hooks');
    const git = async (args: string[], cwd = this.repo) => {
      const parameters = ['-c', `core.hooksPath=${hooks}`, ...args];
      return (await (this.processes ? this.processes.exec('git', parameters, { cwd, timeout: 15000, signal, operation: 'synthetic_git' })
        : exec('git', parameters, { cwd, windowsHide: true, timeout: 15000, maxBuffer: 65536, signal }))).stdout.trim();
    };
    // Only a single-file seed repository is permitted. An application's hooks/scripts cannot run.
    if (await git(['ls-tree', '--name-only', this.baseSha]) !== 'synthetic-seed.txt'
      || `${await git(['show', `${this.baseSha}:synthetic-seed.txt`])}\n` !== SYNTHETIC_SEED) throw Error('synthetic_repository_required');
    const location = path.join(this.root, mission.missionId);
    const branch = `codex/${mission.missionId}`;
    const info = await exists(location);
    if (!info) {
      if (!create) return { location, branch, exists: false };
      await git(['worktree', 'add', '-b', branch, location, this.baseSha]);
    } else if (!info.isDirectory() || info.isSymbolicLink()) throw Error('unsafe_worktree');
    if (await realpath(location) !== location
      || await git(['rev-parse', 'HEAD'], location) !== this.baseSha
      || await git(['branch', '--show-current'], location) !== branch
      || await realpath(await git(['rev-parse', '--path-format=absolute', '--git-common-dir'], location))
        !== await realpath(await git(['rev-parse', '--path-format=absolute', '--git-common-dir']))) throw Error('worktree_mismatch');
    return { location, branch, exists: true };
  }
  async observe(context: ExecutorContext, signal?: AbortSignal): Promise<SyntheticObservation> {
    this.authorize(context, false);
    const { location, exists: present } = await this.workspace(context, false, signal);
    if (!present) return { worktree: 'missing', result: 'missing', test: 'missing' };
    const folder = path.join(location, '.autopilot-synthetic');
    const info = await exists(folder);
    if (info && (!info.isDirectory() || info.isSymbolicLink())) throw Error('unsafe_artifact_directory');
    const inspect = async (name: string, content: string): Promise<'missing' | 'valid' | 'conflict'> => {
      const file = path.join(folder, name); const entry = await exists(file);
      if (!entry) return 'missing';
      return entry.isFile() && !entry.isSymbolicLink() && entry.size === Buffer.byteLength(content)
        && await readFile(file, 'utf8') === content ? 'valid' : 'conflict';
    };
    return { worktree: 'ready', result: await inspect('result.txt', SYNTHETIC_CONTENTS), test: await inspect('result.test.cjs', SYNTHETIC_TEST_SOURCE) };
  }
  async execute(context: ExecutorContext, signal?: AbortSignal): Promise<ExecutorResult> {
    signal?.throwIfAborted();
    this.authorize(context, true);
    const mission = context.mission;
    const step = mission.plan.find(s => s.id === context.checkpoint.current_step_id);
    if (!step) throw Error('invalid_step');
    const action = step.task;
    const { location, branch, exists: present } = await this.workspace(context, action === 'synthetic.prepare', signal);
    if (!present) throw Error('worktree_missing');
    let summary = 'isolated_worktree_verified';
    const folder = path.join(location, '.autopilot-synthetic');
    if (action !== 'synthetic.prepare') {
      const folderInfo = await exists(folder);
      if (folderInfo && (!folderInfo.isDirectory() || folderInfo.isSymbolicLink())) throw Error('unsafe_artifact_directory');
      if (!folderInfo) { if (action !== 'synthetic.modify') throw Error('artifact_missing'); await mkdir(folder); }
      const expected = [['result.txt', SYNTHETIC_CONTENTS], ['result.test.cjs', SYNTHETIC_TEST_SOURCE]] as const;
      const missing: Array<readonly [string, string]> = [];
      // Validate every prerequisite before the first write. A later conflict must not leave a partial effect.
      for (const [name, content] of expected) {
        const file = path.join(folder, name);
        const previous = await exists(file);
        if (previous) {
          if (!previous.isFile() || previous.isSymbolicLink() || previous.size !== Buffer.byteLength(content)
            || await readFile(file, 'utf8') !== content) throw Error('artifact_conflict');
        } else {
          if (action !== 'synthetic.modify') throw Error('artifact_missing');
          missing.push([file, content]);
        }
      }
      for (const [file, content] of missing) { signal?.throwIfAborted(); await writeFile(file, content, { flag: 'wx' }); }
      summary = missing.length ? 'synthetic_effect_written' : 'synthetic_effect_reconciled';
      if (action === 'synthetic.verify') {
        // Do not inherit NODE_OPTIONS/preload hooks or application credentials into the fixture test.
        const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : []));
        const parameters = ['--test', path.join(folder, 'result.test.cjs')];
        if (this.processes) await this.processes.exec(process.execPath, parameters, { cwd: location, env, timeout: 10000, signal, operation: 'synthetic_test' });
        else await exec(process.execPath, parameters, { cwd: location, env, windowsHide: true, timeout: 10000, maxBuffer: 65536, signal });
        summary = 'synthetic_test_passed';
      }
    }
    const completed = [...context.checkpoint.completed_steps, step.id];
    const pending = mission.plan.filter(s => !completed.includes(s.id));
    const next = pending.find(s => s.depends_on.every(id => completed.includes(id)));
    const checkpoint = {
      mission_state: (pending.length ? 'in_progress' : 'ready_to_complete') as 'in_progress' | 'ready_to_complete',
      current_step_id: next?.id ?? null, completed_steps: completed, pending_steps: pending.map(s => s.id),
      results: [...context.checkpoint.results, { step_id: step.id, status: 'passed' as const, summary }],
      artifacts: action === 'synthetic.prepare' ? [] : ['.autopilot-synthetic/result.txt', '.autopilot-synthetic/result.test.cjs'],
      test_evidence: [...context.checkpoint.test_evidence, `${step.id}:${summary}`], worktree: { branch, sha: this.baseSha },
    };
    return { checkpoint, events: [{ type: 'progress', stepId: step.id, summary }], evidence: [`${step.id}:${summary}`] };
  }
}
