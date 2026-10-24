import { beautyServerDatabase } from './beautyDatabase';
import type { ConsultationInput } from './consultationRequest';
import { draftConsultationResponse } from './consultationResponseAgents';

/** Opt-in, fail-closed, one-time acknowledgement for new, routine WEB email consultations.
 * Runs only for the first successfully delivered notification; never processes historic records.
 * The outbox unique request ID is the durable idempotency fence.
 */
export async function maybeSendAutomaticConsultationReply(
  input: ConsultationInput,
  deps: { env?: NodeJS.ProcessEnv; fetch?: typeof fetch } = {},
): Promise<'disabled' | 'ineligible' | 'sent' | 'uncertain' | 'already_claimed'> {
  const env = deps.env || process.env;
  if (env.CONSULTATION_AUTO_REPLY_ENABLED !== 'true' ||
      env.CONSULTATION_REPLY_SENDING_ENABLED !== 'true' ||
      env.CONSULTATION_MAIL_PROVIDER !== 'resend' ||
      env.CONSULTATION_MAIL_FROM !== 'consultas@victoriosas.online' ||
      !env.RESEND_API_KEY) return 'disabled';
  if (input.responseChannel !== 'email' || !input.email || input.age === null || input.age < 18) return 'ineligible';
  const draft = draftConsultationResponse(input);
  if (draft.priority !== 'normal' || draft.reasons.length !== 0) return 'ineligible';
  // Restrict autonomous replies to unambiguous routine enquiries, never medical or freeform requests.
  const message = input.message.trim().normalize('NFC');
  if (!/^(?:hola[,.! ]*)?(?:quisiera (?:saber|consultar) )?(?:precios?|tarifas?|cu[aá]nto cuesta|informaci[oó]n(?: de precios)?)(?:[.?! ]*)$/i.test(message)) return 'ineligible';
  if (/prueba|test|config|simulaci[oó]n/i.test(input.fullName + ' ' + message)) return 'ineligible';

  const db = beautyServerDatabase();
  const inserted = await db.from('consultation_reply_outbox').insert({
    request_id: input.id, approved_by: null, approval_mode: 'automatic',
    recipient: input.email, subject: draft.subject, body: draft.text, state: 'sending',
  });
  if (inserted.error) {
    if (inserted.error.code === '23505') return 'already_claimed';
    return 'uncertain';
  }
  try {
    const response = await (deps.fetch || fetch)('https://api.resend.com/emails', {
      method: 'POST',
      signal: AbortSignal.timeout(8000),
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `consultation-reply-v1/${input.id}`,
      },
      body: JSON.stringify({ from: env.CONSULTATION_MAIL_FROM, to: [input.email], subject: draft.subject, text: draft.text }),
    });
    if (!response.ok) throw Error('PROVIDER_ERROR');
    const result = await response.json() as { id?: unknown };
    if (typeof result.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(result.id)) throw Error('INVALID_PROVIDER_ID');
    const updated = await db.from('consultation_reply_outbox')
      .update({ state: 'sent', provider_message_id: result.id, sent_at: new Date().toISOString() })
      .eq('request_id', input.id).eq('state', 'sending');
    if (updated.error) return 'uncertain';
    return 'sent';
  } catch {
    await db.from('consultation_reply_outbox').update({ state: 'failed_unknown' })
      .eq('request_id', input.id).eq('state', 'sending');
    return 'uncertain';
  }
}
