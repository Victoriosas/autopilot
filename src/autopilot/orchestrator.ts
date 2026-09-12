import { evaluatePolicy, type Actor, type AutopilotAction } from './policyEngine';

export type TaskStatus = 'queued' | 'running' | 'awaiting_approval' | 'completed' | 'failed' | 'blocked';

export interface AutopilotTask<T = unknown> {
  id: string;
  goal: string;
  actor: Actor;
  action: AutopilotAction;
  status: TaskStatus;
  input?: T;
  createdAt: string;
  updatedAt: string;
  audit: Array<{ at: string; event: string; details?: unknown }>;
}

function id(): string {
  return `task_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export class TaskOrchestrator {
  private tasks = new Map<string, AutopilotTask>();

  createTask<T>(goal: string, actor: Actor, action: AutopilotAction, input?: T): AutopilotTask<T> {
    const now = new Date().toISOString();
    const policy = evaluatePolicy({ actor, action });
    const status: TaskStatus = !policy.allowed
      ? policy.requiresHumanApproval ? 'awaiting_approval' : 'blocked'
      : policy.requiresHumanApproval ? 'awaiting_approval' : 'queued';

    const task: AutopilotTask<T> = {
      id: id(), goal, actor, action, status, input, createdAt: now, updatedAt: now,
      audit: [{ at: now, event: 'TASK_CREATED' }, { at: now, event: 'POLICY_EVALUATED', details: policy }],
    };
    this.tasks.set(task.id, task);
    return task;
  }

  getTask(taskId: string): AutopilotTask | undefined {
    return this.tasks.get(taskId);
  }

  listTasks(): AutopilotTask[] {
    return [...this.tasks.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  approve(taskId: string, approvedBy: 'human' | 'codex'): AutopilotTask {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    if (task.status !== 'awaiting_approval') throw new Error(`Task ${taskId} is not awaiting approval`);
    const now = new Date().toISOString();
    task.status = 'queued'; task.updatedAt = now;
    task.audit.push({ at: now, event: 'TASK_APPROVED', details: { approvedBy } });
    return task;
  }

  transition(taskId: string, status: TaskStatus, details?: unknown): AutopilotTask {
    const task = this.tasks.get(taskId);
    if (!task) throw new Error(`Task not found: ${taskId}`);
    const now = new Date().toISOString();
    task.status = status; task.updatedAt = now;
    task.audit.push({ at: now, event: `STATUS_${status.toUpperCase()}`, details });
    return task;
  }
}

let singleton: TaskOrchestrator | null = null;
export function getTaskOrchestrator(): TaskOrchestrator {
  if (!singleton) singleton = new TaskOrchestrator();
  return singleton;
}
