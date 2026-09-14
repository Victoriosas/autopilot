import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export interface ShadowRunAuthorization {
  id: string;
  maxCandidates: number;
  maxAiCalls: number;
  durationMs: number;
}

export function hashShadowRunToken(token: string) {
  return createHash('sha256').update(token, 'utf8').digest('hex');
}

export async function consumeShadowRunAuthorization(token: string): Promise<ShadowRunAuthorization | null> {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SOURCING_DATABASE_NOT_CONFIGURED');

  const db = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (requestUrl, init) => fetch(requestUrl, { ...init, signal: AbortSignal.timeout(10000) }) },
  });

  const { data, error } = await db.rpc('consume_autopilot_shadow_run_authorization', {
    requested_token_hash: hashShadowRunToken(token),
  });
  if (error) throw new Error('SHADOW_AUTH_DATABASE_ERROR');
  if (!data || typeof data !== 'object') return null;

  const limits = (data as any).limits || {};
  const maxCandidates = Math.max(1, Math.min(Number(limits.maxCandidates || 3), 5));
  const maxAiCalls = Math.max(1, Math.min(Number(limits.maxAiCalls || 2), 3));
  const durationMs = Math.max(5000, Math.min(Number(limits.durationMs || 15000), 20000));
  return { id: String((data as any).id), maxCandidates, maxAiCalls, durationMs };
}
