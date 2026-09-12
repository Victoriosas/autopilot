import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProductDraft } from './draftBuilder';

export type DraftReviewStatus = 'draft' | 'ai_approved' | 'rejected' | 'publishing' | 'published';

export interface PersistedProductDraft {
  id: string;
  sourceCandidateId: string;
  status: DraftReviewStatus;
  draft: ProductDraft;
  reviewedBy?: string;
  reviewReason?: string;
  reviewedAt?: string;
  publishedProductId?: string;
  publishedAt?: string;
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
const SELECT_COLUMNS = 'id, source_candidate_id, status, draft, reviewed_by, review_reason, reviewed_at, published_product_id, published_at, created_at, updated_at';

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
    publishedProductId: data.published_product_id || undefined,
    publishedAt: data.published_at || undefined,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
  };
}

export async function persistProductDraft(draft: ProductDraft): Promise<PersistedProductDraft> {
  if (!db) throw new Error('Draft persistence unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured');

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('autopilot_product_drafts')
    .insert({
      id: randomUUID(),
      source_candidate_id: draft.sourceCandidateId,
      status: 'draft',
      draft,
      created_at: now,
      updated_at: now,
    })
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw new Error(`Unable to persist product draft: ${error.message}`);
  return mapRow(data);
}

export async function getPersistedProductDraft(id: string): Promise<PersistedProductDraft> {
  if (!db) throw new Error('Draft persistence unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured');

  const { data, error } = await db
    .from('autopilot_product_drafts')
    .select(SELECT_COLUMNS)
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
  if (!db) throw new Error('Draft persistence unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured');

  const reason = input.reason.trim();
  if (!reason) throw new Error('review reason is required');

  const now = new Date().toISOString();
  const status: DraftReviewStatus = input.decision === 'approve' ? 'ai_approved' : 'rejected';
  const { data, error } = await db
    .from('autopilot_product_drafts')
    .update({ status, reviewed_by: input.reviewer, review_reason: reason, reviewed_at: now, updated_at: now })
    .eq('id', input.id)
    .eq('status', 'draft')
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw new Error(`Unable to review product draft: ${error.message}`);
  return mapRow(data);
}

export async function claimProductDraftPublication(id: string): Promise<PersistedProductDraft> {
  if (!db) throw new Error('Draft persistence unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured');

  const { data, error } = await db
    .from('autopilot_product_drafts')
    .update({ status: 'publishing', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'ai_approved')
    .is('published_product_id', null)
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw new Error(`Unable to claim product draft for publication: ${error.message}`);
  return mapRow(data);
}

export async function releaseProductDraftPublication(id: string): Promise<void> {
  if (!db) return;
  await db
    .from('autopilot_product_drafts')
    .update({ status: 'ai_approved', updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('status', 'publishing')
    .is('published_product_id', null);
}

export async function markProductDraftPublished(input: { id: string; productId: string }): Promise<PersistedProductDraft> {
  if (!db) throw new Error('Draft persistence unavailable: SUPABASE_SERVICE_ROLE_KEY is not configured');

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('autopilot_product_drafts')
    .update({
      status: 'published',
      published_product_id: input.productId,
      published_at: now,
      updated_at: now,
    })
    .eq('id', input.id)
    .eq('status', 'publishing')
    .is('published_product_id', null)
    .select(SELECT_COLUMNS)
    .single();

  if (error) throw new Error(`Unable to mark product draft published: ${error.message}`);
  return mapRow(data);
}

export async function listPersistedProductDrafts(limit = 50): Promise<PersistedProductDraft[]> {
  if (!db) return [];

  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const { data, error } = await db
    .from('autopilot_product_drafts')
    .select(SELECT_COLUMNS)
    .order('created_at', { ascending: false })
    .limit(safeLimit);

  if (error) throw new Error(`Unable to list product drafts: ${error.message}`);
  return (data || []).map(mapRow);
}
