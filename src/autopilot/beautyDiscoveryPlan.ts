import type { SourcingConfig } from './sourcingEvidence';

const searches = ['facial headband', 'gua sha facial tool', 'facial roller', 'spa wrist wash bands',
  'facial cleansing brush manual', 'facial mist', 'hydrogel eye patches', 'face essence'] as const;

// One search per existing run budget. No extra AI requests, publication or purchases.
export function beautyDiscoveryPlan(config: SourcingConfig, slot: number, explicitKeyword?: string): SourcingConfig {
  if (!Number.isSafeInteger(slot) || slot < 0) throw new Error('INVALID_DISCOVERY_SLOT');
  const query = explicitKeyword?.trim();
  if (query) return { ...config, keyword: query.slice(0, 120) };
  const index = slot % searches.length;
  return { ...config, keyword: searches[index], version: `${config.version}:beauty-plan-v1:${index}` };
}
