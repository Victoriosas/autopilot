import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { lstat, mkdir, readFile, readdir, realpath, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ExecutorAdapter, ExecutorContext, ExecutorResult, MissionPlanStep } from './executorAdapter';

const exec = promisify(execFile);
export const SYNTHETIC_GOAL = 'Verify synthetic mission recovery';
export const SYNTHETIC_SEED = 'Autopilot disposable synthetic repository v1\n';
export const SYNTHETIC_PLAN: MissionPlanStep[] = [
  { id: 'prepare', task: 'synthetic.prepare', depends_on: [] },
  { id: 'modify', task: 'synthetic.modify', depends_on: ['prepare'] },
  { id: 'verify', task: 'synthetic.verify', depends_on: ['modify'] },
];
const contents = 'Autopilot completed the authorized synthetic change.\n';
const testSource = `const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
test('authorized synthetic change', () => assert.equal(fs.readFileSync(__dirname + '/result.txt', 'utf8'), ${JSON.stringify(contents)}));
`;
async function exists(location: string) {
  try { return await lstat(location); } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}
/** Fixed-purpose local adapter. No shell, network, model, repository scripts or arbitrary file paths. */
export class SyntheticMissionExecutor implements ExecutorAdapter {
  constructor(readonly executorId: string, private readonly repo: string, private readonly root: string, private readonly baseSha: string) {}
  async execute(context: ExecutorContext, signal?: AbortSignal): Promise<ExecutorResult> {
    signal?.throwIfAborted();
    const mission = context.mission;
    if (!context.permissions.includes('synthetic_worktree') || mission.goal !== SYNTHETIC_GOAL
      || mission.goalVersion !== 1 || mission.planVersion !== 1
      || JSON.stringify(mission.plan) !== JSON.stringify(SYNTHETIC_PLAN)
      || JSON.stringify(mission.restrictions) !== JSON.stringify(['local_synthetic_only', 'no_network', 'no_send'])
      || JSON.stringify(mission.completionCriteria) !== JSON.stringify(['synthetic_test_passed'])
      || !/^synthetic-[a-z0-9-]{1,60}$/.test(mission.missionId)
      || !/^[a-f0-9]{40}$/.test(this.baseSha)) throw Error('synthetic_authorization_required');
    const step = mission.plan.find(s => s.id === context.checkpoint.current_step_id);
    if (!step) throw Error('invalid_step');
    const rootInfo = await exists(this.root);
    if (!rootInfo?.isDirectory() || rootInfo.isSymbolicLink() || await realpath(this.root) !== path.resolve(this.root)) throw Error('unsafe_workspace_root');
    const hooks = path.join(this.root, 'empty-hooks');
    if (!await exists(hooks)) await mkdir(hooks);
    if ((await lstat(hooks)).isSymbolicLink() || (await readdir(hooks)).length) throw Error('unsafe_hooks');
    const git = async (args: string[], cwd = this.repo) => (await exec('git', ['-c', `core.hooksPath=${hooks}`, ...args],
      { cwd, windowsHide: true, timeout: 15000, maxBuffer: 65536, signal })).stdout.trim();
    // Only a single-file seed repository is permitted. An application's hooks/scripts cannot run.
    if (await git(['ls-tree', '--name-only', this.baseSha]) !== 'synthetic-seed.txt'
      || `${await git(['show', `${this.baseSha}:synthetic-seed.txt`])}\n` !== SYNTHETIC_SEED) throw Error('synthetic_repository_required');
    const location = path.join(this.root, mission.missionId);
    const branch = `codex/${mission.missionId}`;
    const info = await exists(location);
    if (!info) {
      if (step.id !== 'prepare') throw Error('worktree_missing');
      await git(['worktree', 'add', '-b', branch, location, this.baseSha]);
    } else if (!info.isDirectory() || info.isSymbolicLink()) throw Error('unsafe_worktree');
    if (await realpath(location) !== location
      || await git(['rev-parse', 'HEAD'], location) !== this.baseSha
      || await git(['branch', '--show-current'], location) !== branch
      || await realpath(await git(['rev-parse', '--path-format=absolute', '--git-common-dir'], location))
        !== await realpath(await git(['rev-parse', '--path-format=absolute', '--git-common-dir']))) throw Error('worktree_mismatch');
    let summary = 'isolated_worktree_verified';
    const folder = path.join(location, '.autopilot-synthetic');
    if (step.id !== 'prepare') {
      const folderInfo = await exists(folder);
      if (folderInfo && (!folderInfo.isDirectory() || folderInfo.isSymbolicLink())) throw Error('unsafe_artifact_directory');
      if (!folderInfo) await mkdir(folder);
      const expected = [['result.txt', contents], ['result.test.cjs', testSource]] as const;
      let reconciled = true;
      for (const [name, content] of expected) {
        const file = path.join(folder, name);
        const previous = await exists(file);
        if (previous) {
          if (!previous.isFile() || previous.isSymbolicLink() || await readFile(file, 'utf8') !== content) throw Error('artifact_conflict');
        } else {
          if (step.id !== 'modify') throw Error('artifact_missing');
          await writeFile(file, content, { flag: 'wx' }); reconciled = false;
        }
      }
      summary = reconciled ? 'synthetic_effect_reconciled' : 'synthetic_effect_written';
      if (step.id === 'verify') {
        // Do not inherit NODE_OPTIONS/preload hooks or application credentials into the fixture test.
        const env = Object.fromEntries(['PATH', 'Path', 'SystemRoot', 'WINDIR', 'TEMP', 'TMP'].flatMap(key => process.env[key] ? [[key, process.env[key]!]] : []));
        await exec(process.execPath, ['--test', path.join(folder, 'result.test.cjs')],
          { cwd: location, env, windowsHide: true, timeout: 10000, maxBuffer: 65536, signal });
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
      artifacts: step.id === 'prepare' ? [] : ['.autopilot-synthetic/result.txt', '.autopilot-synthetic/result.test.cjs'],
      test_evidence: [...context.checkpoint.test_evidence, `${step.id}:${summary}`], worktree: { branch, sha: this.baseSha },
    };
    return { checkpoint, events: [{ type: 'progress', stepId: step.id, summary }], evidence: [`${step.id}:${summary}`] };
  }
}
