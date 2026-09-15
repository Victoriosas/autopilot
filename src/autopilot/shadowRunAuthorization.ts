import { createHash } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

export interface ShadowEconomicPolicy {
  providerToStoreRate?: number;
  minMargin?: number;
  customsRatePct?: number;
  paymentFeePct?: number;
  paymentFeeFixed?: number;
  returnReservePct?: number;
  acquisitionCost?: number;
  taxRatePct?: number;
  imageSaleUseAllowed?: boolean;
  commercialProxiesAllowed?: boolean;
  policyVersion?: string;
}

export interface ShadowRunAuthorization {
  id: string;
  maxCandidates: number;
  maxAiCalls: number;
  durationMs: number;
  policy?: ShadowEconomicPolicy;
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

function bounded(value: unknown, min: number, max: number): number | undefined {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= min && parsed <= max ? parsed : undefined;
}

function normalizePolicy(input: unknown): ShadowEconomicPolicy | undefined {
  if (!input || typeof input !== 'object') return undefined;
  const raw = input as Record<string, unknown>;
  const policy: ShadowEconomicPolicy = {
    providerToStoreRate: bounded(raw.providerToStoreRate, 20, 80),
    minMargin: bounded(raw.minMargin, 20, 50),
    customsRatePct: bounded(raw.customsRatePct, 0, 100),
    paymentFeePct: bounded(raw.paymentFeePct, 0, 20),
    paymentFeeFixed: bounded(raw.paymentFeeFixed, 0, 500),
    returnReservePct: bounded(raw.returnReservePct, 0, 20),
    acquisitionCost: bounded(raw.acquisitionCost, 0, 2000),
    taxRatePct: bounded(raw.taxRatePct, 0, 30),
    imageSaleUseAllowed: raw.imageSaleUseAllowed === true,
    commercialProxiesAllowed: raw.commercialProxiesAllowed === true,
    policyVersion: typeof raw.policyVersion === 'string' ? raw.policyVersion.slice(0, 80) : undefined,
  };
  return Object.values(policy).some(value => value !== undefined) ? policy : undefined;
}

function normalizeAuthorization(data: unknown): ShadowRunAuthorization | null {
  if (!data || typeof data !== 'object') return null;
  const limits = (data as any).limits || {};
  const maxCandidates = Math.max(1, Math.min(Number(limits.maxCandidates || 3), 5));
  const maxAiCalls = Math.max(1, Math.min(Number(limits.maxAiCalls || 2), 3));
  const durationMs = Math.max(5000, Math.min(Number(limits.durationMs || 15000), 20000));
  return { id: String((data as any).id), maxCandidates, maxAiCalls, durationMs, policy: normalizePolicy(limits.policy) };
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
