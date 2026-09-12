import { randomUUID } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { ProductDraft } from './draftBuilder';

export interface GovernedPublishResult {
  productId: string;
  slug: string;
  sku: string;
  status: 'published';
}

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase service role not configured');
    supabase = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return supabase;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 70);
}

export async function publishApprovedDraft(draft: ProductDraft): Promise<GovernedPublishResult> {
  if (!draft?.sourceCandidateId?.trim()) throw new Error('sourceCandidateId is required');
  if (!draft?.title?.trim()) throw new Error('title is required');
  if (!Number.isFinite(draft.price) || draft.price <= 0) throw new Error('published price must be positive');

  const db = getSupabase();
  const suffix = randomUUID().replace(/-/g, '').slice(0, 8);
  const slug = `${slugify(draft.title) || 'producto'}-${suffix}`;
  const sku = `VIC-AI-${suffix.toUpperCase()}`;

  const row = {
    title: draft.title,
    slug,
    sku,
    subtitle: draft.subtitle || null,
    description: draft.description || null,
    category: draft.category || null,
    price: draft.price,
    compare_at_price: draft.compareAtPrice || null,
    inventory: 0,
    rating: null,
    review_count: 0,
    status: 'published',
    tags: draft.tags || [],
    badges: [],
    features: draft.features || [],
    specs: draft.specs || {},
    images: draft.images || [],
    brand: 'Victoriosa',
  };

  const { data, error } = await db
    .from('products')
    .insert(row)
    .select('id')
    .single();

  if (error) throw new Error(`Unable to publish approved draft: ${error.message}`);

  return {
    productId: data.id,
    slug,
    sku,
    status: 'published',
  };
}
