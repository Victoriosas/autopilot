import { beautyServerDatabase } from './beautyDatabase';
import { draftConsultationResponse } from './consultationResponseAgents';
import type { ConsultationRecord } from './consultationSupabase';

export type ReplyOutcome = 'sent' | 'already_processing' | 'invalid_channel' | 'provider_unavailable';
/** Idempotency is enforced by the unique request_id in consultation_reply_outbox.
 * A network error has an unknown delivery outcome, so it is never blindly retried.
 */
export async function approveAndSendConsultationReply(
  record: ConsultationRecord, adminId: string,
  deps: { fetch?: typeof fetch; env?: NodeJS.ProcessEnv; approvedText?:string; claim?:()=>Promise<boolean> } = {},
): Promise<ReplyOutcome> {
  const env = deps.env || process.env;
  if (record.input.responseChannel !== 'email' || !record.input.email) return 'invalid_channel';
  if (new Date(record.expires_at).getTime() <= Date.now()) return 'provider_unavailable';
  if (env.CONSULTATION_REPLY_SENDING_ENABLED !== 'true' ||
      env.CONSULTATION_MAIL_PROVIDER !== 'resend' || !env.RESEND_API_KEY ||
      env.CONSULTATION_MAIL_FROM !== 'consultas@victoriosas.online') return 'provider_unavailable';
  const draft = draftConsultationResponse(record.input);
  const body=deps.approvedText??draft.text;
  const db = beautyServerDatabase();
  const approved = deps.claim ? {error:await deps.claim()?null:{code:'23505'}} : await db.from('consultation_reply_outbox').insert({
    request_id: record.id,
    approved_by: adminId,
    recipient: record.input.email,
    subject: draft.subject,
    body,
    state: 'sending',
  });
  if (approved.error) {
    if (approved.error.code === '23505') return 'already_processing';
    throw Error('CONSULTATION_REPLY_STORE_UNAVAILABLE');
  }
  try {
    const response = await (deps.fetch || fetch)('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(8000),
      headers: {
        'Authorization': `Bearer ${env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': `consultation-reply-v1/${record.id}`,
      },
      body: JSON.stringify({
        from: env.CONSULTATION_MAIL_FROM, to: [record.input.email],
        subject: draft.subject, text: body,
      }),
    });
    if (!response.ok) throw Error('CONSULTATION_REPLY_PROVIDER_UNAVAILABLE');
    const data = await response.json() as { id?: unknown };
    if (typeof data.id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(data.id))
      throw Error('CONSULTATION_REPLY_PROVIDER_INVALID');
    const update = await db.from('consultation_reply_outbox')
      .update({ state: 'sent', provider_message_id: data.id, sent_at: new Date().toISOString() })
      .eq('request_id', record.id).eq('state', 'sending');
    if (update.error) throw Error('CONSULTATION_REPLY_STORE_UNAVAILABLE');
    return 'sent';
  } catch {
    // Never retry automatically: the provider may have accepted the message.
    await db.from('consultation_reply_outbox').update({ state: 'failed_unknown' })
      .eq('request_id', record.id).eq('state', 'sending');
    return 'provider_unavailable';
  }
}
