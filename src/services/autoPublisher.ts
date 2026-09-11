import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProductAnalysis } from './productAnalyzer';

let supabase: SupabaseClient | null = null;

const MIN_PRODUCTS_PER_CATEGORY = 30;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
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
  sourceRunId?: string
): Promise<PublishResult> {
  const db = getSupabase();

  const overallScore = analysis.analysis.overallScore;
  const riskLevel = analysis.risk.level;
  const category = analysis.category;

  // Check if category already has enough products
  const categoryCount = await getCategoryCount(category);
  if (categoryCount >= MIN_PRODUCTS_PER_CATEGORY) {
    return {
      success: true,
      status: 'draft',
      skippedReason: `Category "${category}" already has ${categoryCount} products (limit: ${MIN_PRODUCTS_PER_CATEGORY})`,
    };
  }

  let status: 'published' | 'draft' | 'rejected';
  if (overallScore >= 70 && riskLevel !== 'critical') {
    status = 'published';
  } else if (overallScore >= 50) {
    status = 'published';
  } else {
    status = 'rejected';
  }

  if (status === 'rejected') {
    return {
      success: true,
      status: 'rejected',
      error: `Score ${overallScore} below threshold, risk: ${riskLevel}`,
    };
  }

  const slug = analysis.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');

  const sku = cjProduct.productSku
    ? `CJ-${cjProduct.productSku}`
    : `VIC-CJ-${Date.now().toString().slice(-6)}`;

  const images = cjProduct.productImage
    ? [cjProduct.productImage]
    : ['https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=900&auto=format&fit=crop&q=80'];

  const productData: any = {
    title: analysis.title,
    slug,
    sku,
    description: analysis.description,
    features: analysis.features,
    specs: analysis.specs,
    price: analysis.pricing.suggestedPrice,
    compare_at_price: analysis.pricing.compareAtPrice,
    images,
    category,
    tags: analysis.tags,
    badges: analysis.badges,
    status,
    rating: 0,
    review_count: 0,
    inventory: cjProduct.stockQuantity || 999,
    brand: 'Victoriosa',
  };

  const { data, error } = await db
    .from('products')
    .insert(productData)
    .select('id')
    .single();

  if (error) {
    console.error('Supabase insert error:', error);
    return { success: false, status, error: error.message };
  }

  if (sourceRunId) {
    await db.from('discovered_products').insert({
      sourcing_run_id: sourceRunId,
      source: 'cj_dropshipping',
      source_id: String(cjProduct.pid || ''),
      source_url: cjProduct.productUrl || '',
      title: analysis.title,
      description: analysis.description,
      price: analysis.pricing.suggestedPrice,
      original_price: Number(cjProduct.salePrice || 25),
      images,
      category,
      rating: 0,
      review_count: 0,
      shipping_cost: 3.5,
      shipping_time: '7-15 days',
      supplier_name: 'CJ Dropshipping',
      supplier_rating: 4.5,
      margin_percentage: analysis.pricing.marginPct,
      ai_score: overallScore,
      ai_analysis: analysis as any,
      status,
      published_product_id: data?.id || null,
    });
  }

  return { success: true, productId: data?.id, status };
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
  sourceRunId?: string
): Promise<BatchResult> {
  let published = 0;
  let draft = 0;
  let rejected = 0;
  let errors = 0;
  let skipped = 0;
  const byCategory: Record<string, { published: number; draft: number; rejected: number }> = {};

  for (const { cjProduct, analysis } of products) {
    const category = analysis.category;
    if (!byCategory[category]) {
      byCategory[category] = { published: 0, draft: 0, rejected: 0 };
    }

    try {
      const result = await publishProduct(cjProduct, analysis, sourceRunId);
      if (result.success) {
        if (result.status === 'published') {
          published++;
          byCategory[category].published++;
        } else if (result.status === 'draft') {
          draft++;
          byCategory[category].draft++;
          if (result.skippedReason) {
            skipped++;
          }
        } else {
          rejected++;
          byCategory[category].rejected++;
        }
      } else {
        errors++;
      }
    } catch (err) {
      console.error('Batch publish error:', err);
      errors++;
    }
  }

  return { published, draft, rejected, errors, skipped, byCategory };
}
