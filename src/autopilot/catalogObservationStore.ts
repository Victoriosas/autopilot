import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { CatalogObservation } from './catalogMonitor';

let db: SupabaseClient | null = null;

function getDb(): SupabaseClient {
  if (!db) {
    const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) throw new Error('Catalog observation persistence requires SUPABASE_SERVICE_ROLE_KEY');
    db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  }
  return db;
}

export async function persistCatalogObservations(observations: CatalogObservation[]): Promise<number> {
  if (!observations.length) return 0;
  const rows = observations.map((item) => ({
    product_id: item.productId,
    observed_at: item.observedAt,
    source: item.source,
    severity: item.severity,
    current_price: item.currentPrice,
    observed_supplier_cost: item.observedSupplierCost ?? null,
    observed_stock: item.observedStock ?? null,
    signals: item.signals,
    provenance: item.provenance,
  }));
  const { error } = await getDb().from('autopilot_catalog_observations').insert(rows);
  if (error) throw new Error(`Unable to persist catalog observations: ${error.message}`);
  return rows.length;
}

export async function listCatalogObservationHistory(productId: string, limit = 50) {
  const safeLimit = Math.max(1, Math.min(Number(limit) || 50, 500));
  const { data, error } = await getDb()
    .from('autopilot_catalog_observations')
    .select('*')
    .eq('product_id', productId)
    .order('observed_at', { ascending: false })
    .limit(safeLimit);
  if (error) throw new Error(`Unable to load catalog observation history: ${error.message}`);
  return data || [];
}
