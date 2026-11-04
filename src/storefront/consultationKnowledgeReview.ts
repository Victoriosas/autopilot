import type { ServiceKnowledge } from './consultationServiceKnowledge';

export type KnowledgeReviewState = 'missing' | 'draft' | 'approved' | 'expired';
export type KnowledgeReviewRow = {
  slug: string;
  name: string;
  state: KnowledgeReviewState;
  version: number | null;
  priceApproved: boolean;
};
export type KnowledgeReviewSummary = {
  total: number;
  missing: number;
  draft: number;
  approved: number;
  expired: number;
  priceApproved: number;
  rows: KnowledgeReviewRow[];
};

/** Counts only saved, nonexpired professional approvals. Never exposes fee amounts. */
export function summarizeKnowledgeReview(
  services: readonly { slug: string; name: string }[],
  entries: readonly ServiceKnowledge[],
  now = Date.now(),
): KnowledgeReviewSummary {
  const bySlug = new Map(entries.map(entry => [entry.slug, entry]));
  const rows = services.map(service => {
    const entry = bySlug.get(service.slug);
    let state: KnowledgeReviewState = 'missing';
    if (entry) {
      const expiry = entry.validUntil === null ? null : Date.parse(entry.validUntil);
      const expired = expiry !== null && (!Number.isFinite(expiry) || expiry <= now);
      state = expired ? 'expired' : entry.approvedForAI && Boolean(entry.description.trim()) ? 'approved' : 'draft';
    }
    return {
      slug: service.slug,
      name: service.name,
      state,
      version: entry?.version ?? null,
      priceApproved: Boolean(entry && state !== 'expired' && entry.priceApproved && entry.internalFee.trim()),
    };
  });
  return {
    total: rows.length,
    missing: rows.filter(row => row.state === 'missing').length,
    draft: rows.filter(row => row.state === 'draft').length,
    approved: rows.filter(row => row.state === 'approved').length,
    expired: rows.filter(row => row.state === 'expired').length,
    priceApproved: rows.filter(row => row.priceApproved).length,
    rows,
  };
}

export const knowledgeReviewLabel: Readonly<Record<KnowledgeReviewState, string>> = {
  missing: 'Sin ficha',
  draft: 'Borrador sin aprobación para IA',
  approved: 'Descripción aprobada para IA',
  expired: 'Vigencia vencida',
};
