import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { ProductAnalysis } from './productAnalyzer';

let supabase: SupabaseClient | null = null;

function getSupabase(): SupabaseClient {
  if (!supabase) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
    if (!url || !key) throw new Error('Supabase not configured');
    supabase = createClient(url, key);
  }
  return supabase;
}

export interface PublishResult {
  success: boolean;
  productId?: string;
  status: 'published' | 'draft' | 'rejected';
  error?: string;
}

export async function publishProduct(
  cjProduct: any,
  analysis: ProductAnalysis,
  sourceRunId?: string
): Promise<PublishResult> {
  const db = getSupabase();

  const overallScore = analysis.analysis.overallScore;
  const riskLevel = analysis.risk.level;

  let status: 'published' | 'draft' | 'rejected';
  if (overallScore >= 85 && riskLevel === 'low') {
    status = 'published';
  } else if (overallScore >= 70 && riskLevel !== 'critical') {
    status = 'draft';
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
    category: analysis.category,
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
      category: analysis.category,
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

export async function publishBatch(
  products: Array<{ cjProduct: any; analysis: ProductAnalysis }>,
  sourceRunId?: string
): Promise<{ published: number; draft: number; rejected: number; errors: number }> {
  let published = 0;
  let draft = 0;
  let rejected = 0;
  let errors = 0;

  for (const { cjProduct, analysis } of products) {
    try {
      const result = await publishProduct(cjProduct, analysis, sourceRunId);
      if (result.success) {
        if (result.status === 'published') published++;
        else if (result.status === 'draft') draft++;
        else rejected++;
      } else {
        errors++;
      }
    } catch (err) {
      console.error('Batch publish error:', err);
      errors++;
    }
  }

  return { published, draft, rejected, errors };
}
