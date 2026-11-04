import { beautyCallerDatabase, beautyServerDatabase } from './beautyDatabase';
import { consultationKnowledge } from './consultationKnowledge';
import type { ConsultationFact } from './consultationEvidence';
import { strictObject } from './consultationIntelligenceContracts';

export type ServiceKnowledge = { slug: string; version: number; description: string; techniques: string; duration: string;
  conditions: string; faq: string; internalFee: string; approvedForAI: boolean; priceApproved: boolean; validUntil: string | null };
const contentKeys = ['description', 'techniques', 'duration', 'conditions', 'faq', 'internalFee'] as const;
export function validateServiceKnowledge(value: unknown): ServiceKnowledge {
  if (!strictObject(value, ['slug','version',...contentKeys,'approvedForAI','priceApproved','validUntil']) ||
    !consultationKnowledge.services.some(s => s.slug === value.slug) || !Number.isSafeInteger(value.version) || (value.version as number) < 0 ||
    contentKeys.some(k => typeof value[k] !== 'string' || (value[k] as string).length > 2000 || /[<>\x00-\x08]/.test(value[k] as string)) ||
    typeof value.approvedForAI !== 'boolean' || typeof value.priceApproved !== 'boolean' ||
    value.approvedForAI && !(value.description as string).trim() || value.priceApproved && !(value.internalFee as string).trim() ||
    value.validUntil !== null && (typeof value.validUntil !== 'string' || !Number.isFinite(Date.parse(value.validUntil)) || Date.parse(value.validUntil) <= Date.now())) throw Error('KNOWLEDGE_INPUT_INVALID');
  return value as ServiceKnowledge;
}
export interface ServiceKnowledgeStore {
  list(token: string): Promise<ServiceKnowledge[]>;
  save(token: string, value: ServiceKnowledge): Promise<boolean>;
  facts(): Promise<ConsultationFact[]>;
}
export const serviceKnowledgeStore: ServiceKnowledgeStore = {
  async list(token) { const r = await beautyCallerDatabase(token).rpc('consultation_knowledge_list'); if (r.error) throw Error('KNOWLEDGE_UNAVAILABLE'); return r.data ?? []; },
  async save(token, value) { const r = await beautyCallerDatabase(token).rpc('consultation_knowledge_save', { p_entry: value }); if (r.error) throw Error('KNOWLEDGE_SAVE_REJECTED'); return r.data === true; },
  async facts() { const r = await beautyServerDatabase().rpc('consultation_knowledge_facts'); if (r.error) throw Error('KNOWLEDGE_UNAVAILABLE'); return r.data ?? []; },
};
