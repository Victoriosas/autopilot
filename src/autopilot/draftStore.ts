import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProductDraft } from './draftBuilder';

export interface PersistedProductDraft {
  id: string;
  sourceCandidateId: string;
  status: 'draft';
  draft: ProductDraft;
  createdAt: string;
  updatedAt: string;
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

export function draftPersistenceStatus() {
  return {
    backend: db ? 'supabase' : 'disabled',
    durable: Boolean(db),
  } as const;
}

export async function persistProductDraft(draft: ProductDraft): Promise<PersistedProductDraft> {
  if (!db) {
    throw new Error('Draft persistence unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  const now = new Date().toISOString();
  const id = randomUUID();
  const row = {
    id,
    source_candidate_id: draft.sourceCandidateId,
    status: 'draft',
    draft,
    created_at: now,
    updated_at: now,
  };

  const { data, error } = await db
    .from('autopilot_product_drafts')
    .insert(row)
    .select('id, source_candidate_id, status, draft, created_at, updated_at')
    .single();

  if (error) throw new Error(`Unable to persist product draft: ${error.message}`);

  return {
    id: data.id,
    sourceCandidateId: data.source_candidate_id,
    status: 'draft',
    draft: data.draft as ProductDraft,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function listPersistedProductDrafts(limit = 50): Promise<PersistedProductDraft[]> {
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const { data, error } = await db
    .from('autopilot_product_drafts')
    .select('id, source_candidate_id, status, draft, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(`Unable to list product drafts: ${error.message}`);

  return (data || []).map((row: any) => ({
    id: row.id,
    sourceCandidateId: row.source_candidate_id,
    status: 'draft',
    draft: row.draft as ProductDraft,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }));
}
