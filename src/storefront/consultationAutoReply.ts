import type { ConsultationInput } from './consultationRequest';

/** Retired acknowledgement path. Historical outbox records remain unchanged.
 * Environment flags cannot authorize a new customer reply: it must go through
 * the authenticated, explicit human-approval route. No database/provider calls.
 */
export async function maybeSendAutomaticConsultationReply(
  _input: ConsultationInput,
  _deps: { env?: NodeJS.ProcessEnv; fetch?: typeof fetch } = {},
): Promise<'disabled'> {
  return 'disabled';
}
