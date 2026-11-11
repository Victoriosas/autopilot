import { groundedBinding, groundedContext, groundedPhrases, GROUNDED_VERSION, type GroundedOptions, type GroundedPart } from './consultationGroundedPolicy';
import type { ConsultationInput } from './consultationRequest';
export type GroundedDraft = ReturnType<typeof composeGroundedConsultation>;

/** Pure composition. Never calls a model, persistence, guardian or delivery capability. */
export function composeGroundedConsultation(input: ConsultationInput, options: GroundedOptions = {}) {
  const context = groundedContext(input, options);
  const phrase = (key: keyof typeof groundedPhrases): GroundedPart => ({ kind: 'phrase', key, text: groundedPhrases[key], version: GROUNDED_VERSION });
  const body: GroundedPart[] = [...context.sources.map(({ source, ...part }) => part), ...context.required.map(phrase)];
  return {
    version: GROUNDED_VERSION, input_binding: groundedBinding(input, options), intent: context.prepared.classification.primary,
    answer_status: 'draft' as const, channel: input.responseChannel,
    variants: (['brief','cordial','explanatory'] as const).map(style => {
      const parts = [phrase(style), ...body, phrase('close')];
      return { style, response_text: parts.map(part => part.text).join(style === 'brief' ? '\n' : '\n\n'), parts };
    }),
    sources: context.sources.map(({ key, version, source }) => ({ id: key, version, source })),
    missing_information: [...context.prepared.classification.missing, ...context.pending],
    information_request: context.requestChannel ? { channel: context.requestChannel, state: 'pending_human_review' as const,
      delivery_decision: 'no_send' as const, external_contact_authorized: false as const } : null,
    requires_human_review: true as const, guardian_status: 'pending' as const, delivery_decision: 'no_send' as const,
  };
}
