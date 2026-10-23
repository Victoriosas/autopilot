import { beautyCallerDatabase, beautyServerDatabase } from './beautyDatabase';
import type { ConsultationInput } from './consultationRequest';

export type ConsultationClaim = { state: 'send' | 'accepted' | 'pending' | 'conflict' | 'throttled' | 'expired'; lease?: string };
export type ConsultationRecord = { id: string; input: ConsultationInput; created_at: string; expires_at: string };
export interface ConsultationStore {
  ready(): Promise<boolean>;
  claim(input: ConsultationInput, fingerprint: string, abuseHash: string): Promise<ConsultationClaim>;
  finish(id: string, lease: string, providerId: string): Promise<boolean>;
  list?(token: string, offset: number): Promise<ConsultationRecord[]>;
}
export const consultationSupabaseStore: ConsultationStore = {
  async list(token, offset) {
    const result = await beautyCallerDatabase(token).from('consultation_requests').select('id,input,created_at,expires_at').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).range(offset, offset + 49);
    if (result.error) throw Error('CONSULTATION_UNAVAILABLE');
    return result.data as ConsultationRecord[];
  },
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
