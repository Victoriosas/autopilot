import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { ProductAnalysis } from './productAnalyzer';
import { mapCategoryToSpanish } from './productSourcingService';

let supabase: SupabaseClient | null = null;
const MIN_PRODUCTS_PER_CATEGORY = 30;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Supabase service role not configured');
    supabase = createClient(url, key);
  }
  return supabase;
}

async function getCategoryCount(category: string): Promise<number> {
  const db = getSupabase();
  const { count } = await db
    .from('products')
    .select('*', { count: 'exact', head: true })
    .eq('category', category)
    .eq('status', 'published');
  return count || 0;
}

export interface PublishResult {
  success: boolean;
  productId?: string;
  status: 'published' | 'draft' | 'rejected';
  error?: string;
  skippedReason?: string;
}

export async function publishProduct(
  cjProduct: any,
  analysis: ProductAnalysis,
  sourceRunId?: string,
  options: { humanApproved?: boolean } = {},
): Promise<PublishResult> {
  const db = getSupabase();
  const category = mapCategoryToSpanish(analysis.category);
  const revenueScore = Number(analysis.analysis.revenueScore || 0);
  const confidenceScore = Number(analysis.analysis.confidenceScore || 0);
  const riskLevel = analysis.risk.level;

  if (revenueScore < 35 || riskLevel === 'critical') {
    return {
      success: true,
      status: 'rejected',
      error: `Revenue score ${revenueScore}, confidence ${confidenceScore}, risk ${riskLevel}`,
    };
  }

  const categoryCount = await getCategoryCount(category);

  // Legacy sourcing is draft-only. Even a historical humanApproved flag must never
  // publish directly. Publication now goes exclusively through the persisted
  // draft -> Council 2/3 -> ai_approved -> governedPublisher path.
  const status: 'draft' = 'draft';
  const legacyPublishBypassRequested = options.humanApproved === true;

  const slugBase = analysis.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
  const slug = `${slugBase || 'producto'}-${String(cjProduct.pid || Date.now()).slice(-8)}`;
  const sku = cjProduct.productSku ? `CJ-${cjProduct.productSku}` : `VIC-CJ-${Date.now().toString().slice(-8)}`;
  const images = cjProduct.productImage ? [cjProduct.productImage] : [];
  const observedStock = Number(cjProduct.stockQuantity);
  const inventory = Number.isFinite(observedStock) && observedStock >= 0 ? observedStock : 0;

  const productData: any = {
    title: analysis.title,
    slug,
    sku,
    description: analysis.description,
    features: analysis.features,
    specs: analysis.specs,
    price: analysis.pricing.suggestedPrice,
    compare_at_price: null,
    cost_price: Number(cjProduct.salePrice || cjProduct.sellPrice || 0) || null,
    images,
    category,
    tags: analysis.tags,
    badges: analysis.badges,
    status,
    rating: null,
    review_count: 0,
    inventory,
    brand: 'Victoriosa',
  };

  const { data, error } = await db.from('products').insert(productData).select('id').single();
  if (error) return { success: false, status, error: error.message };

  if (sourceRunId) {
    const supplierPrice = Number(cjProduct.salePrice || cjProduct.sellPrice);
    const shippingCost = Number(cjProduct.shippingCost);
    await db.from('discovered_products').insert({
      sourcing_run_id: sourceRunId,
      source: 'cj_dropshipping',
      source_id: String(cjProduct.pid || ''),
      source_url: cjProduct.productUrl || null,
      title: analysis.title,
      description: analysis.description,
      price: analysis.pricing.suggestedPrice,
      original_price: Number.isFinite(supplierPrice) ? supplierPrice : null,
      images,
      category,
      rating: null,
      review_count: 0,
      shipping_cost: Number.isFinite(shippingCost) ? shippingCost : null,
      shipping_time: null,
      supplier_name: 'CJ Dropshipping',
      supplier_rating: null,
      margin_percentage: analysis.pricing.marginPct,
      ai_score: revenueScore,
      ai_analysis: {
        ...analysis,
        publication: {
          directPublicationAllowed: false,
          legacyPublishBypassRequested,
          approvalPath: 'autopilot_council_2_of_3',
          source: 'cj_dropshipping',
          sourceId: String(cjProduct.pid || ''),
        },
      } as any,
      status,
      published_product_id: null,
    });
  }

  const reasons = [
    categoryCount >= MIN_PRODUCTS_PER_CATEGORY
      ? `Category ${category} already has ${categoryCount} published products`
      : null,
    legacyPublishBypassRequested
      ? 'Legacy direct publish request blocked; Council approval is required'
      : 'Legacy sourcing is draft-only; Council approval is required',
  ].filter(Boolean);

  return {
    success: true,
    productId: data?.id,
    status,
    skippedReason: reasons.join(' | '),
  };
}

export interface BatchResult {
  published: number;
  draft: number;
  rejected: number;
  errors: number;
  skipped: number;
  byCategory: Record<string, { published: number; draft: number; rejected: number }>;
}

export async function publishBatch(
  products: Array<{ cjProduct: any; analysis: ProductAnalysis }>,
  sourceRunId?: string,
): Promise<BatchResult> {
  let published = 0;
  let draft = 0;
  let rejected = 0;
  let errors = 0;
  let skipped = 0;
  const byCategory: Record<string, { published: number; draft: number; rejected: number }> = {};

  for (const { cjProduct, analysis } of products) {
    const category = mapCategoryToSpanish(analysis.category);
    byCategory[category] ||= { published: 0, draft: 0, rejected: 0 };
    try {
      const result = await publishProduct(cjProduct, analysis, sourceRunId, { humanApproved: false });
      if (!result.success) {
        errors++;
        continue;
      }
      if (result.status === 'published') {
        published++;
        byCategory[category].published++;
      } else if (result.status === 'draft') {
        draft++;
        byCategory[category].draft++;
        if (result.skippedReason) skipped++;
      } else {
        rejected++;
        byCategory[category].rejected++;
      }
    } catch (error) {
      console.error('Batch publish error:', error);
      errors++;
    }
  }

  return { published, draft, rejected, errors, skipped, byCategory };
}
