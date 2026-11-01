import { createHash } from 'node:crypto';
import { CONSULTATION_UUID } from './consultationRequest';
import { beautyServerDatabase } from './beautyDatabase';

export interface ConsultationDelivery { ready(): boolean; signature?(): string; send(id: string): Promise<string>; }
export function createConsultationDelivery(deps: { env?: Record<string, string | undefined>; fetch?: typeof fetch } = {}): ConsultationDelivery {
  const env = deps.env || process.env, request = deps.fetch || fetch;
  const from = env.CONSULTATION_MAIL_FROM?.trim() || '', to = env.CONSULTATION_MAIL_TO?.trim() || '';
  const edge = process.env.AUTOPILOT_RUNTIME === 'supabase-edge';
  const ready = () => env.CONSULTATION_MAIL_ENABLED === 'true' && env.CONSULTATION_MAIL_PROVIDER === 'resend'
    && (edge || Boolean(env.RESEND_API_KEY?.trim())) && /^[a-z0-9._+-]+@victoriosas\.online$/i.test(from) && to === 'victoriosas.online@gmail.com';
  // In Supabase Edge, the credential is held in encrypted Vault and exposed only through
  // a service_role-restricted RPC. Never embed provider credentials into the bundle.
  const senderKey = async (): Promise<string> => {
    if (!edge) return env.RESEND_API_KEY?.trim() || '';
    const { data, error } = await beautyServerDatabase().rpc('consultation_resend_sender_key');
    if (error || typeof data !== 'string' || !/^re_[A-Za-z0-9_-]{16,}$/.test(data)) throw Error('CONSULTATION_UNAVAILABLE');
    return data;
  };
  return {
    ready,
    signature: () => createHash('sha256').update(JSON.stringify({ from, to, template: 'consultation-v1' })).digest('hex'),
    async send(id) {
      if (!ready() || !CONSULTATION_UUID.test(id)) throw Error('CONSULTATION_UNAVAILABLE');
      try {
        const key = await senderKey();
        if (!key) throw Error('CONSULTATION_UNAVAILABLE');
        const response = await request('https://api.resend.com/emails', { method: 'POST', signal: AbortSignal.timeout(8000),
          headers: { authorization: `Bearer ${key}`, 'Content-Type': 'application/json', 'Idempotency-Key': `consultation-v1/${id}` },
          body: JSON.stringify({ from, to: [to], subject: 'Nueva consulta en Victoriosas',
            text: `Hay una nueva consulta para revisar en el panel privado de Victoriosas. Referencia: ${id}. Accedé con tu cuenta autorizada. Este aviso no confirma una reserva.` }) });
        if (!response.ok) throw Error('CONSULTATION_UNAVAILABLE');
        const result = await response.json();
        if (typeof result?.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(result.id)) throw Error('CONSULTATION_UNAVAILABLE');
        return result.id;
      } catch { throw Error('CONSULTATION_UNAVAILABLE'); }
    },
  };
}
