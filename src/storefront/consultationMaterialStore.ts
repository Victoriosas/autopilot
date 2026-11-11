import { beautyCallerDatabase } from './beautyDatabase';
import type { ConsultationInput } from './consultationRequest';
export type MaterialPayload = { schema_version: 'material-v1'; material: 'approved_information'; intent: string; channel: string;
  sources: { id: string; version: string; source: string; sha256: string }[]; input_binding: string; parent_fingerprint: string; context_expires_at: string; consent_version: string };
export interface MaterialStore {
  context(token: string, request: string): Promise<{ input: ConsultationInput; fingerprint: string; expiresAt: string }>;
  save(token: string, request: string, operation: string, payload: MaterialPayload): Promise<{ id: string; state: string; delivery_decision: 'no_send' }>;
  list(token: string, request: string): Promise<unknown[]>;
  review(token: string, id: string, state: 'reviewed' | 'rejected' | 'revoked'): Promise<boolean>;
  purge(token: string): Promise<number>;
}
export function createMaterialStore(database = beautyCallerDatabase): MaterialStore {
  const rpc = async (token: string, name: string, params: Record<string, unknown> = {}) => {
    const result = await database(token).rpc(name, params);
    if (result.error || result.data === null) throw Error('MATERIAL_UNAVAILABLE');
    return result.data;
  };
  return {
    context: (token, request) => rpc(token, 'consultation_material_context', { p_request: request }),
    save: (token, request, operation, payload) => rpc(token, 'consultation_material_save', { p_request: request, p_operation: operation, p_payload: payload }),
    async list(token, request) {
      const result = await database(token).from('consultation_material_requests').select('id,operation_id,payload,consent_state,review_state,delivery_decision,created_at,updated_at,expires_at').eq('request_id', request).order('created_at', { ascending: false });
      if (result.error) throw Error('MATERIAL_UNAVAILABLE'); return result.data;
    },
    review: (token, id, state) => rpc(token, 'consultation_material_review', { p_id: id, p_state: state }),
    purge: token => rpc(token, 'consultation_material_purge'),
  };
}
