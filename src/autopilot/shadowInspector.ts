import { createClient } from '@supabase/supabase-js';

function adminDb() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('SOURCING_DATABASE_NOT_CONFIGURED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function inspectShadowRun(runId?: string) {
  const db = adminDb();

  const { data: runs, error: runsError } = await db
    .from('autopilot_sourcing_runs')
    .select('id,status,mode,run_key,scope,model_calls,error_count,error_code,metrics,created_at,started_at,completed_at,resume_count,config')
    .order('created_at', { ascending: false })
    .limit(10);
  if (runsError) throw runsError;

  const selectedRun = runId
    ? (runs || []).find((run: any) => run.id === runId)
    : (runs || [])[0];

  if (!selectedRun) return { runs: runs || [], run: null, items: [] };

  const { data: items, error: itemsError } = await db
    .from('autopilot_sourcing_items')
    .select('id,run_id,identity,status,payload,checkpoint,draft_id,council,attempt,error_code,created_at,updated_at')
    .eq('run_id', selectedRun.id)
    .order('created_at', { ascending: true });
  if (itemsError) throw itemsError;

  return {
    runs: runs || [],
    run: selectedRun,
    items: (items || []).map((item: any) => ({
      id: item.id,
      identity: item.identity,
      status: item.status,
      title: item.payload?.candidate?.title || item.payload?.facts?.description?.slice?.(0, 100) || item.identity,
      image: item.payload?.facts?.images?.[0] || null,
      sourceUrl: item.payload?.sourceUrl || item.payload?.candidate?.sourceUrl || null,
      variantId: item.payload?.variantId || null,
      stock: item.payload?.stock ?? null,
      supplierCost: item.payload?.supplierCost ?? null,
      shippingCost: item.payload?.shippingCost ?? null,
      currency: item.payload?.currency || null,
      destination: item.payload?.destination || null,
      shippingVerified: item.payload?.shippingVerified === true,
      victoriosaFit: item.checkpoint?.victoriosaFit || null,
      marketEvidence: item.checkpoint?.marketEvidence || null,
      quote: item.checkpoint?.quote || null,
      reasons: item.checkpoint?.reasons || [],
      council: item.council || null,
      draftId: item.draft_id || null,
      attempt: item.attempt || 0,
      errorCode: item.error_code || null,
      createdAt: item.created_at,
      updatedAt: item.updated_at,
    })),
  };
}
