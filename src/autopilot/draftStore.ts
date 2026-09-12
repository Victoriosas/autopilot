import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProductDraft } from './draftBuilder';

export type DraftReviewStatus = 'draft' | 'ai_approved' | 'rejected';

export interface PersistedProductDraft {
  id: string;
  sourceCandidateId: string;
  status: DraftReviewStatus;
  draft: ProductDraft;
  reviewedBy?: string;
  reviewReason?: string;
  reviewedAt?: string;
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

function mapRow(data: any): PersistedProductDraft {
  return {
    id: data.id,
    sourceCandidateId: data.source_candidate_id,
    status: data.status as DraftReviewStatus,
    draft: data.draft as ProductDraft,
    reviewedBy: data.reviewed_by || undefined,
    reviewReason: data.review_reason || undefined,
    reviewedAt: data.reviewed_at || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
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
    .select('id, source_candidate_id, status, draft, reviewed_by, review_reason, reviewed_at, created_at, updated_at')
    .single();

  if (error) throw new Error(`Unable to persist product draft: ${error.message}`);
  return mapRow(data);
}

export async function getPersistedProductDraft(id: string): Promise<PersistedProductDraft> {
  if (!db) {
    throw new Error('Draft persistence unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  const { data, error } = await db
    .from('autopilot_product_drafts')
    .select('id, source_candidate_id, status, draft, reviewed_by, review_reason, reviewed_at, created_at, updated_at')
    .eq('id', id)
    .single();

  if (error) throw new Error(`Unable to load product draft: ${error.message}`);
  return mapRow(data);
}

export async function reviewProductDraft(input: {
  id: string;
  decision: 'approve' | 'reject';
  reviewer: string;
  reason: string;
}): Promise<PersistedProductDraft> {
  if (!db) {
    throw new Error('Draft persistence unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured');
  }

  const reason = input.reason.trim();
  if (!reason) throw new Error('review reason is required');

  const now = new Date().toISOString();
  const status: DraftReviewStatus = input.decision === 'approve' ? 'ai_approved' : 'rejected';
  const { data, error } = await db
    .from('autopilot_product_drafts')
    .update({
      status,
      reviewed_by: input.reviewer,
      review_reason: reason,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', input.id)
    .eq('status', 'draft')
    .select('id, source_candidate_id, status, draft, reviewed_by, review_reason, reviewed_at, created_at, updated_at')
    .single();

  if (error) throw new Error(`Unable to review product draft: ${error.message}`);
  return mapRow(data);
}

export async function listPersistedProductDrafts(limit = 50): Promise<PersistedProductDraft[]> {
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const { data, error } = await db
    .from('autopilot_product_drafts')
    .select('id, source_candidate_id, status, draft, reviewed_by, review_reason, reviewed_at, created_at, updated_at')
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(`Unable to list product drafts: ${error.message}`);
  return (data || []).map(mapRow);
}
