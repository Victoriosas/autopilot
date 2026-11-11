import { createHash } from 'node:crypto';
import { CONSULTATION_UUID, type ConsultationInput } from './consultationRequest';
import { reviewGroundedConsultation } from './consultationGroundedGuardian';
import type { GroundedDraft } from './consultationGroundedComposer';
import type { GroundedOptions } from './consultationGroundedPolicy';
import { createMaterialStore, type MaterialStore, type MaterialPayload } from './consultationMaterialStore';
const canonical = (value: unknown): string => JSON.stringify(value, (_key, item) => item && typeof item === 'object' && !Array.isArray(item) ? Object.fromEntries(Object.entries(item).sort(([a],[b]) => a.localeCompare(b))) : item);

/** Internal supervised boundary. Caller JWT/RLS authoritative; never accepts a send capability. */
export async function persistConsultationMaterial(input: ConsultationInput, draft: GroundedDraft, operationId: string,
  options: GroundedOptions & { token: string; store?: MaterialStore }) {
  const closed = { state: 'unavailable' as const, delivery_decision: 'no_send' as const };
  try {
    if (!options.token || !CONSULTATION_UUID.test(operationId) || !CONSULTATION_UUID.test(input.id) || !input.consent || !draft.information_request) return closed;
    const store = options.store ?? createMaterialStore();
    const context = await store.context(options.token, input.id);
    if (canonical(context.input) !== canonical(input) || Date.parse(context.expiresAt) <= (options.now ?? new Date()).getTime() || !Number.isFinite(Date.parse(context.expiresAt))) return closed;
    const review = reviewGroundedConsultation(input, draft, options);
    if (review.status === 'blocked' || review.delivery_decision !== 'no_send' || !draft.sources.length) return closed;
    const payload: MaterialPayload = { schema_version: 'material-v1', material: 'approved_information', intent: draft.intent,
      channel: draft.information_request.channel, input_binding: draft.input_binding, parent_fingerprint: context.fingerprint, context_expires_at: options.context?.expiresAt ?? context.expiresAt, consent_version: input.consentVersion,
      sources: draft.sources.map(source => {
        const part = draft.variants[0].parts.find(part => part.kind === 'source' && part.key === source.id);
        if (!part) throw Error();
        return { ...source, sha256: createHash('sha256').update(part.text).digest('hex') };
      }) };
    const saved = await store.save(options.token, input.id, operationId, payload);
    if (!CONSULTATION_UUID.test(saved.id) || saved.delivery_decision !== 'no_send' || !['pending','reviewed','rejected'].includes(saved.state)) return closed;
    return { state: 'persisted' as const, id: saved.id, review_state: saved.state, delivery_decision: 'no_send' as const };
  } catch { return closed; }
}
