import { beautyServerDatabase } from './beautyDatabase';

export interface ConsultationReadStore {
  list(ids: string[]): Promise<Record<string, string>>;
  set(id: string, adminId: string, read: boolean): Promise<string | null>;
  unreadCount(): Promise<number>;
}

/** Server-only access, after route authentication and caller-visible consultation lookup. */
export const consultationReadStore: ConsultationReadStore = {
  async list(ids) {
    if (!ids.length) return {};
    const result = await beautyServerDatabase().from('consultation_read_states').select('request_id,read_at').in('request_id', ids);
    if (result.error) throw Error('CONSULTATION_UNAVAILABLE');
    return Object.fromEntries(result.data.map(row => [row.request_id, row.read_at]));
  },
  async set(id, adminId, read) {
    const db = beautyServerDatabase();
    if (!read) {
      const result = await db.from('consultation_read_states').delete().eq('request_id', id);
      if (result.error) throw Error('CONSULTATION_UNAVAILABLE');
      return null;
    }
    const result = await db.from('consultation_read_states').upsert({
      request_id: id, read_by: adminId, read_at: new Date().toISOString(),
    }, { onConflict: 'request_id' }).select('read_at').single();
    if (result.error || typeof result.data?.read_at !== 'string') throw Error('CONSULTATION_UNAVAILABLE');
    return result.data.read_at;
  },
  async unreadCount() {
    const result = await beautyServerDatabase().from('consultation_read_metrics').select('unread_requests').single();
    const value = result.data?.unread_requests;
    if (result.error || !(typeof value === 'number' || typeof value === 'string' && /^\d+$/.test(value))) throw Error('CONSULTATION_UNAVAILABLE');
    const count = Number(value);
    if (!Number.isSafeInteger(count) || count < 0) throw Error('CONSULTATION_UNAVAILABLE');
    return count;
  },
};
