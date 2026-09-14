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

function client() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SOURCING_DATABASE_NOT_CONFIGURED');
  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (requestUrl, init) => fetch(requestUrl, { ...init, signal: AbortSignal.timeout(10000) }) },
  });
}

function normalizeAuthorization(data: unknown): ShadowRunAuthorization | null {
  if (!data || typeof data !== 'object') return null;
  const limits = (data as any).limits || {};
  const maxCandidates = Math.max(1, Math.min(Number(limits.maxCandidates || 3), 5));
  const maxAiCalls = Math.max(1, Math.min(Number(limits.maxAiCalls || 2), 3));
  const durationMs = Math.max(5000, Math.min(Number(limits.durationMs || 15000), 20000));
  return { id: String((data as any).id), maxCandidates, maxAiCalls, durationMs };
}

export async function consumeShadowRunAuthorization(token: string): Promise<ShadowRunAuthorization | null> {
  const { data, error } = await client().rpc('consume_autopilot_shadow_run_authorization', {
    requested_token_hash: hashShadowRunToken(token),
  });
  if (error) throw new Error('SHADOW_AUTH_DATABASE_ERROR');
  return normalizeAuthorization(data);
}

export async function consumeShadowRunAuthorizationById(id: string): Promise<ShadowRunAuthorization | null> {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id)) return null;
  const { data, error } = await client().rpc('consume_autopilot_shadow_run_authorization_id', {
    requested_id: id,
  });
  if (error) throw new Error('SHADOW_AUTH_DATABASE_ERROR');
  return normalizeAuthorization(data);
}
