import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { AutopilotTask } from './orchestrator';

export interface AuditEvent {
  taskId: string;
  at: string;
  event: string;
  details?: unknown;
}

function createSupabase(): SupabaseClient | null {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const db = createSupabase();

export function taskPersistenceStatus() {
  return {
    backend: db ? 'supabase' : 'memory-only',
    durable: Boolean(db),
  } as const;
}

export async function persistTask(task: AutopilotTask): Promise<void> {
  if (!db) return;

  const { error } = await db.from('agent_tasks').upsert({
    id: task.id,
    goal: task.goal,
    actor: task.actor,
    action: task.action,
    status: task.status,
    input: task.input ?? null,
    created_at: task.createdAt,
    updated_at: task.updatedAt,
  });

  if (error) throw new Error(`Unable to persist agent task: ${error.message}`);
}

export async function persistAuditEvent(event: AuditEvent): Promise<void> {
  if (!db) return;

  const { error } = await db.from('agent_audit_events').insert({
    task_id: event.taskId,
    event_type: event.event,
    details: event.details ?? null,
    created_at: event.at,
  });

  if (error) throw new Error(`Unable to persist audit event: ${error.message}`);
}

export async function listPersistedTasks(limit = 100): Promise<AutopilotTask[]> {
  if (!db) return [];

  const { data, error } = await db
    .from('agent_tasks')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(Math.max(1, Math.min(limit, 500)));

  if (error) throw new Error(`Unable to list agent tasks: ${error.message}`);

  return (data || []).map((row: any) => ({
    id: row.id,
    goal: row.goal,
    actor: row.actor,
    action: row.action,
    status: row.status,
    input: row.input ?? undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    audit: [],
  }));
}
