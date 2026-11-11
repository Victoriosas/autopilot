import { checkDraft, type EvalCase } from './consultationAgentEval';
import { groundedBinding, groundedContext, groundedPhrases, GROUNDED_VERSION, type GroundedOptions } from './consultationGroundedPolicy';
import type { ConsultationInput } from './consultationRequest';
import type { GroundedDraft } from './consultationGroundedComposer';

/** Independent validation against freshly retrieved sources, never a composer-supplied approval. */
export function reviewGroundedConsultation(input: ConsultationInput, candidate: unknown, options: GroundedOptions = {}) {
  const codes = new Set<string>();
  let context: ReturnType<typeof groundedContext>;
  try { context = groundedContext(input, options); } catch { return { status: 'blocked' as const, codes: ['CONTEXT_INVALID'], delivery_decision: 'no_send' as const }; }
  const draft = candidate as GroundedDraft;
  try {
    if (JSON.stringify(candidate).length > 32000) throw Error();
    const fields = ['version','input_binding','intent','answer_status','channel','variants','sources','missing_information','information_request','requires_human_review','guardian_status','delivery_decision'];
    if (Object.keys(draft).sort().join() !== fields.sort().join()) codes.add('DRAFT_SCHEMA_INVALID');
    if (!draft || draft.version !== GROUNDED_VERSION || draft.input_binding !== groundedBinding(input, options) || draft.intent !== context.prepared.classification.primary || draft.channel !== input.responseChannel) codes.add('CONTEXT_CHANGED');
    if (draft.answer_status !== 'draft' || draft.requires_human_review !== true || draft.guardian_status !== 'pending' || draft.delivery_decision !== 'no_send') codes.add('DELIVERY_POLICY_CHANGED');
    const expectedRefs = context.sources.map(({ key, version, source }) => ({ id: key, version, source }));
    if (JSON.stringify(draft.sources) !== JSON.stringify(expectedRefs)) codes.add('SOURCES_CHANGED');
    if (JSON.stringify(draft.missing_information) !== JSON.stringify([...context.prepared.classification.missing, ...context.pending])) codes.add('MISSING_INFORMATION_CHANGED');
    const expectedRequest = context.requestChannel ? { channel: context.requestChannel, state: 'pending_human_review', delivery_decision: 'no_send', external_contact_authorized: false } : null;
    if (JSON.stringify(draft.information_request) !== JSON.stringify(expectedRequest)) codes.add('INFORMATION_REQUEST_CHANGED');
    if (!Array.isArray(draft.variants) || draft.variants.length !== 3) throw Error();
    for (const [index, variant] of draft.variants.entries()) {
      const style = (['brief','cordial','explanatory'] as const)[index];
      if (Object.keys(variant).sort().join() !== 'parts,response_text,style') codes.add('DRAFT_SCHEMA_INVALID');
      if (/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}|\+?\d[\d ()-]{6,}\d/i.test(variant.response_text)) codes.add('PRIVATE_CONTACT_DATA');
      if (variant.style !== style || !Array.isArray(variant.parts) || variant.parts.length > 80) throw Error();
      const expectedKeys = [style, ...context.sources.map(source => source.key), ...context.required, 'close'];
      if (JSON.stringify(variant.parts.map(part => part.key)) !== JSON.stringify(expectedKeys)) codes.add('CLAUSES_CHANGED');
      for (const part of variant.parts) {
        if (Object.keys(part).sort().join() !== 'key,kind,text,version') codes.add('PART_SCHEMA_INVALID');
        const source = context.sources.find(source => source.key === part.key);
        if (part.kind === 'source' ? !source || part.text !== source.text || part.version !== source.version :
          part.kind !== 'phrase' || !Object.hasOwn(groundedPhrases, part.key) || part.text !== groundedPhrases[part.key as keyof typeof groundedPhrases] || part.version !== GROUNDED_VERSION) codes.add('UNSUPPORTED_CLAIM');
      }
      if (variant.response_text !== variant.parts.map(part => part.text).join(style === 'brief' ? '\n' : '\n\n')) codes.add('TEXT_CHANGED');
    }
    // Reuse the existing production draft schema and deterministic Guardian checks.
    const existing = { schema_version: '1.0', questions: ['q1'], services_candidates: context.prepared.classification.serviceCandidates,
      knowledge_gaps: draft.missing_information, variants: { personalizada: draft.variants[1].response_text, breve: draft.variants[0].response_text, orientacion: draft.variants[2].response_text },
      used_evidence: expectedRefs.map(({ id, version }) => ({ id, version })), pending_questions: context.pending,
      guardian: { status: 'REQUIERE_VICTORIA', reasons: [] }, action: 'BORRADOR_NO_ENVIADO' };
    const fixture: EvalCase = { id: 'grounded-local', split: 'desarrollo', family: 'grounded', message: '',
      evidence: context.sources.map(source => ({ id: source.key, version: source.version, vigente: true, extracto: source.text })),
      expected_guardian_global: 'REQUIERE_VICTORIA', expected_requires_victoria: true, must_not_contain: [], must_cover: ['q1'], critical: true, synthetic: true };
    for (const issue of checkDraft(fixture, existing)) codes.add(issue.code);
  } catch { codes.add('DRAFT_SCHEMA_INVALID'); }
  if (!input.consent || context.prepared.classification.risks.some(risk => ['injection','privacy_or_complaint'].includes(risk))) codes.add('REQUIRES_PRIVATE_REVIEW');
  const status = codes.size ? 'blocked' : context.pending.length || context.required.length ? 'requires_information' : 'approved_for_human_review';
  return { status, codes: [...codes], delivery_decision: 'no_send' as const };
}
