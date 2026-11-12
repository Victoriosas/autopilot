import { beautyCallerDatabase } from './beautyDatabase';
import type { MaterialPayload } from './consultationMaterialStore';

export interface MaterialAdminRow {
  id: string; review_state: 'pending' | 'reviewed' | 'rejected' | 'revoked'; consent_state: 'granted' | 'revoked';
  delivery_decision: 'no_send'; created_at: string; updated_at: string; expires_at: string; available: boolean;
  metadata: Pick<MaterialPayload, 'intent' | 'channel' | 'sources' | 'consent_version'> | null;
  events: { id: number; event: string; occurred_at: string }[];
}
export function createMaterialAdminStore(database = beautyCallerDatabase) {
  const rpc = async (token: string, name: string, params: Record<string, unknown>): Promise<any> => {
    if (!token) throw Error('MATERIAL_UNAVAILABLE');
    const result = await database(token).rpc(name, params);
    if (result.error || result.data === null) throw Error('MATERIAL_UNAVAILABLE');
    return result.data;
  };
  return {
    snapshot: (token: string, request: string): Promise<MaterialAdminRow[]> => rpc(token, 'consultation_material_admin_snapshot', { p_request: request }),
    review: (token: string, request: string, id: string, updated: string, state: string): Promise<boolean> => rpc(token, 'consultation_material_admin_review', { p_request: request, p_id: id, p_updated: updated, p_state: state }),
    purge: (token: string, request: string): Promise<number> => rpc(token, 'consultation_material_admin_purge', { p_request: request }),
  };
}
export type MaterialAdminStore = ReturnType<typeof createMaterialAdminStore>;
