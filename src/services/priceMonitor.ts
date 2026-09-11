import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCJClient } from './cjDropshipping';

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

export interface PriceAlert {
  productId: string;
  title: string;
  oldPrice: number;
  newPrice: number;
  changePercent: number;
  action: 'repriced' | 'flagged' | 'unchanged';
}

export async function monitorPrices(): Promise<PriceAlert[]> {
  const db = getSupabase();
  const cj = getCJClient();
  if (!cj) return [];

  const { data: products } = await db
    .from('products')
    .select('id, title, price, sku, compare_at_price')
    .eq('brand', 'Victoriosa')
    .not('sku', 'like', 'VIC-%')
    .limit(50);

  if (!products || products.length === 0) return [];

  const alerts: PriceAlert[] = [];

  for (const product of products) {
    try {
      const sku = product.sku?.replace('CJ-', '');
      if (!sku) continue;

      const detail = await cj.getProductDetail(sku);
      if (!detail) continue;

      const supplierPrice = detail.salePrice;
      const currentPrice = product.price;
      const costIncrease = supplierPrice > currentPrice * 0.7;

      if (costIncrease) {
        const newPrice = Math.ceil(supplierPrice * 2.5 * 100) / 100;
        const rounded = newPrice > 20 ? Math.ceil(newPrice) - 0.05 : Math.round(newPrice * 2) / 2 - 0.05;

        alerts.push({
          productId: product.id,
          title: product.title,
          oldPrice: currentPrice,
          newPrice: rounded,
          changePercent: ((rounded - currentPrice) / currentPrice) * 100,
          action: 'repriced',
        });

        await db
          .from('products')
          .update({ price: rounded })
          .eq('id', product.id);
      }
    } catch (err) {
      console.error(`[PriceMonitor] Error checking ${product.sku}:`, err);
    }
  }

  return alerts;
}

export async function getProductsNeedingRestock(): Promise<any[]> {
  const db = getSupabase();
  const { data } = await db
    .from('products')
    .select('id, title, sku, inventory, price')
    .lt('inventory', 10)
    .eq('brand', 'Victoriosa')
    .limit(20);
  return data || [];
}
