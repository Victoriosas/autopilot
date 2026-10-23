import { beautyServerDatabase } from './beautyDatabase';
import type { ConsultationInput } from './consultationRequest';

export type ConsultationClaim = { state: 'send' | 'accepted' | 'pending' | 'conflict' | 'throttled' | 'expired'; lease?: string };
export interface ConsultationStore {
  ready(): Promise<boolean>;
  claim(input: ConsultationInput, fingerprint: string, abuseHash: string): Promise<ConsultationClaim>;
  finish(id: string, lease: string, providerId: string): Promise<boolean>;
}
export const consultationSupabaseStore: ConsultationStore = {
  async ready() {
    try { const result = await beautyServerDatabase().rpc('consultation_schema_ready'); return !result.error && result.data === 'consultation-v1'; } catch { return false; }
  },
  async claim(input, fingerprint, abuseHash) {
    const result = await beautyServerDatabase().rpc('consultation_claim', { p_input: input, p_fingerprint: fingerprint, p_abuse_hash: abuseHash });
    if (result.error || !result.data || !['send', 'accepted', 'pending', 'conflict', 'throttled', 'expired'].includes(result.data.state)) throw Error('CONSULTATION_UNAVAILABLE');
    return result.data as ConsultationClaim;
  },
  async finish(id, lease, providerId) {
    const result = await beautyServerDatabase().rpc('consultation_finish', { p_id: id, p_lease: lease, p_provider_id: providerId });
    return !result.error && result.data === true;
  },
};
