export interface DiagnosticItem {
  status: string;
  reasons?: unknown;
}

const successful = new Set(['shadow_completed', 'production_ready', 'published']);
const blocked = new Set(['needs_evidence', 'evidence_rejected', 'pricing_rejected', 'council_rejected', 'failed_terminal', 'failed_retryable']);

function nextAction(code: string): string {
  if (code.startsWith('MARKET_')) return 'Revisar proveedor de mercado y comparables verificables en Uruguay antes de repetir la búsqueda.';
  if (code.includes('SHIPPING')) return 'Obtener una cotización de flete para la variante y el destino seleccionados.';
  if (code.includes('STOCK')) return 'Verificar inventario real de la variante con el proveedor.';
  if (code.startsWith('URUGUAY_')) return 'Revisar requisitos regulatorios antes de continuar con este producto.';
  if (code.startsWith('VICTORIOSA_')) return 'Ajustar la búsqueda a accesorios de autocuidado compatibles con Victoriosa.';
  if (code.includes('MARGIN') || code.includes('PRICING') || code.includes('COST') || code.includes('FX') || code.includes('CURRENCY')) return 'Revisar costos, moneda y margen con datos verificados; mantener las barreras comerciales.';
  if (code.startsWith('COMMERCIAL_EVIDENCE') || code.startsWith('OBSERVED_SCORE')) return 'Completar la evidencia comercial faltante antes de recalcular la oportunidad.';
  return 'Revisar el checkpoint y la evidencia del producto antes de iniciar otra corrida.';
}

/** Counts observed outcomes, never sales, projected revenue or publication eligibility. */
export function diagnoseShadowItems(items: DiagnosticItem[]) {
  const statusCounts: Record<string, number> = Object.create(null);
  const counts = new Map<string, number>();
  let blockedItems = 0;
  let successfulItems = 0;
  for (const item of items) {
    statusCounts[item.status] = (statusCounts[item.status] || 0) + 1;
    if (successful.has(item.status)) successfulItems++;
    if (!blocked.has(item.status)) continue;
    blockedItems++;
    const reasons = Array.isArray(item.reasons)
      ? item.reasons.filter((reason): reason is string => typeof reason === 'string' && reason.trim().length > 0)
      : [];
    // One product can have multiple blockers; duplicate reasons count only once.
    for (const code of new Set(reasons.length ? reasons : [`STATUS:${item.status}`])) {
      counts.set(code, (counts.get(code) || 0) + 1);
    }
  }
  const blockers = [...counts].map(([code, itemCount]) => ({ code, itemCount, nextAction: nextAction(code) }))
    .sort((a, b) => b.itemCount - a.itemCount || a.code.localeCompare(b.code));
  return {
    totalItems: items.length,
    successfulItems,
    blockedItems,
    pendingItems: items.length - successfulItems - blockedItems,
    statusCounts,
    blockers,
    nextAction: blockers[0]?.nextAction || (items.length === 0
      ? 'No hay productos persistidos para diagnosticar; revisar estado y descubrimiento de la corrida.'
      : successfulItems === items.length
        ? 'Revisar los resultados bajo la política de publicación vigente; completar Shadow no autoriza publicar.'
        : 'Revisar el estado de la corrida y sus checkpoints pendientes antes de reanudar.'),
  };
}
