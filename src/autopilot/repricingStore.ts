import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { RepricingCouncilResult } from './repricingCouncil';
import type { RepricingProposal } from './repricingProposal';

export interface PersistedRepricingProposal {
  id: string;
  productId: string;
  status: 'pending' | 'ai_approved' | 'rejected' | 'applied';
  proposal: RepricingProposal;
  council?: RepricingCouncilResult;
  reviewedBy?: string;
  reviewedAt?: string;
  appliedAt?: string;
  createdAt: string;
  updatedAt: string;
}

let db: SupabaseClient | null = null;

function getDb(): SupabaseClient {
  if (!db) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Repricing persistence requires SUPABASE_SERVICE_ROLE_KEY');
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return db;
}

function mapRow(row: any): PersistedRepricingProposal {
  return {
    id: row.id,
    productId: row.product_id,
    status: row.status,
    proposal: row.proposal,
    council: row.council || undefined,
    reviewedBy: row.reviewed_by || undefined,
    reviewedAt: row.reviewed_at || undefined,
    appliedAt: row.applied_at || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function persistRepricingProposal(proposal: RepricingProposal): Promise<PersistedRepricingProposal> {
  const { data, error } = await getDb()
    .from('autopilot_repricing_proposals')
    .insert({ product_id: proposal.productId, proposal, status: 'pending' })
    .select('*')
    .single();
  if (error) throw new Error(`Unable to persist repricing proposal: ${error.message}`);
  return mapRow(data);
}

export async function getRepricingProposal(id: string): Promise<PersistedRepricingProposal> {
  const { data, error } = await getDb().from('autopilot_repricing_proposals').select('*').eq('id', id).single();
  if (error) throw new Error(`Unable to load repricing proposal: ${error.message}`);
  return mapRow(data);
}

export async function recordRepricingCouncil(id: string, council: RepricingCouncilResult): Promise<PersistedRepricingProposal> {
  const status = council.decision === 'approve' ? 'ai_approved' : 'rejected';
  const now = new Date().toISOString();
  const { data, error } = await getDb()
    .from('autopilot_repricing_proposals')
    .update({
      status,
      council,
      reviewed_by: `repricing-council:${council.quorum}`,
      reviewed_at: now,
      updated_at: now,
    })
    .eq('id', id)
    .eq('status', 'pending')
    .select('*')
    .single();
  if (error) throw new Error(`Unable to record repricing council: ${error.message}`);
  return mapRow(data);
}

export async function applyApprovedRepricing(id: string): Promise<PersistedRepricingProposal> {
  const record = await getRepricingProposal(id);
  if (record.status === 'applied') return record;
  if (record.status !== 'ai_approved') throw new Error('repricing proposal is not ai_approved');
  const proposedPrice = record.proposal.proposedPrice;
  if (!proposedPrice || !Number.isFinite(proposedPrice) || proposedPrice <= 0) throw new Error('approved proposal has no valid price');

  const db = getDb();
  const { error: productError } = await db.from('products').update({ price: proposedPrice }).eq('id', record.productId);
  if (productError) throw new Error(`Unable to apply product price: ${productError.message}`);

  const now = new Date().toISOString();
  const { data, error } = await db
    .from('autopilot_repricing_proposals')
    .update({ status: 'applied', applied_at: now, updated_at: now })
    .eq('id', id)
    .eq('status', 'ai_approved')
    .select('*')
    .single();
  if (error) throw new Error(`Unable to mark repricing as applied: ${error.message}`);
  return mapRow(data);
}

export async function listRepricingProposals(limit = 50): Promise<PersistedRepricingProposal[]> {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const { data, error } = await getDb()
    .from('autopilot_repricing_proposals')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(safeLimit);
  if (error) throw new Error(`Unable to list repricing proposals: ${error.message}`);
  return (data || []).map(mapRow);
}
