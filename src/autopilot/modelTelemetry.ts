import { createClient, type SupabaseClient } from '@supabase/supabase-js';

export interface ModelCallEvent {
  taskType: string;
  provider: string;
  model: string;
  status: 'success' | 'error';
  latencyMs: number;
  inputTokens?: number;
  outputTokens?: number;
  estimatedCostUsd?: number;
  errorCode?: string;
  metadata?: unknown;
  createdAt?: string;
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

export function modelTelemetryStatus() {
  return { enabled: Boolean(db), backend: db ? 'supabase' : 'console-only' } as const;
}

export async function recordModelCall(event: ModelCallEvent): Promise<void> {
  const createdAt = event.createdAt || new Date().toISOString();

  if (!db) {
    console.info('[AI][telemetry]', {
      taskType: event.taskType,
      provider: event.provider,
      model: event.model,
      status: event.status,
      latencyMs: event.latencyMs,
      errorCode: event.errorCode,
    });
    return;
  }

  const { error } = await db.from('model_calls').insert({
    task_type: event.taskType,
    provider: event.provider,
    model: event.model,
    status: event.status,
    latency_ms: Math.max(0, Math.round(event.latencyMs)),
    input_tokens: event.inputTokens ?? null,
    output_tokens: event.outputTokens ?? null,
    estimated_cost_usd: event.estimatedCostUsd ?? null,
    error_code: event.errorCode ?? null,
    metadata: event.metadata ?? null,
    created_at: createdAt,
  });

  if (error) {
    console.warn(`[AI][telemetry] unable to persist model call: ${error.message}`);
  }
}
