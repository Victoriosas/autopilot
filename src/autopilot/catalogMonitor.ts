import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { getCJClient } from '../services/cjDropshipping';

export type ObservationSeverity = 'info' | 'warning' | 'critical';

export interface CatalogObservation {
  productId: string;
  title: string;
  source: 'cj_dropshipping' | 'unknown';
  observedAt: string;
  supplierProductId?: string;
  currentPrice: number;
  observedSupplierCost?: number;
  observedStock?: number;
  severity: ObservationSeverity;
  signals: string[];
  provenance: {
    product: 'verified';
    supplierCost?: 'observed';
    stock?: 'observed';
  };
}

let db: SupabaseClient | null = null;

function getDb(): SupabaseClient {
  if (!db) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Catalog monitor requires SUPABASE_SERVICE_ROLE_KEY');
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return db;
}

export async function observePublishedCatalog(limit = 50): Promise<CatalogObservation[]> {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 200));
  const { data, error } = await getDb()
    .from('products')
    .select('id,title,price,cj_product_id,status')
    .eq('status', 'published')
    .limit(safeLimit);

  if (error) throw new Error(`Unable to load published catalog: ${error.message}`);

  const cj = getCJClient();
  const observations: CatalogObservation[] = [];

  for (const product of data || []) {
    const base: CatalogObservation = {
      productId: product.id,
      title: product.title,
      source: product.cj_product_id ? 'cj_dropshipping' : 'unknown',
      supplierProductId: product.cj_product_id || undefined,
      currentPrice: Number(product.price || 0),
      observedAt: new Date().toISOString(),
      severity: 'info',
      signals: [],
      provenance: { product: 'verified' },
    };

    if (!cj || !product.cj_product_id) {
      base.signals.push('supplier_live_observation_unavailable');
      observations.push(base);
      continue;
    }

    try {
      const supplier = await cj.getProductDetail(product.cj_product_id);
      if (!supplier) {
        base.severity = 'warning';
        base.signals.push('supplier_product_not_found');
      } else {
        const cost = Number(supplier.salePrice || supplier.sellPrice);
        const stock = Number(supplier.stockQuantity);
        if (Number.isFinite(cost) && cost > 0) {
          base.observedSupplierCost = cost;
          base.provenance.supplierCost = 'observed';
        }
        if (Number.isFinite(stock) && stock >= 0) {
          base.observedStock = stock;
          base.provenance.stock = 'observed';
          if (stock === 0) {
            base.severity = 'critical';
            base.signals.push('observed_out_of_stock');
          }
        }
      }
    } catch (error: any) {
      base.severity = 'warning';
      base.signals.push(`supplier_observation_failed:${String(error?.message || 'unknown').slice(0, 160)}`);
    }

    observations.push(base);
  }

  return observations;
}
