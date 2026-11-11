import { createHash } from 'node:crypto';
import { prepareConsultationFAQ } from './consultationFAQ';
import { consultationKnowledge } from './consultationKnowledge';
import { normalizeIntelligenceText } from './consultationUnderstanding';
import type { ConsultationInput } from './consultationRequest';
import type { ConsultationFact } from './consultationEvidence';

export const GROUNDED_VERSION = 'consultation-grounded-v1';
export const groundedPhrases = {
  brief: 'Hola.', cordial: 'Hola, gracias por escribirnos.', explanatory: 'Hola, te compartimos la información disponible.',
  close: 'La propuesta queda pendiente de revisión de Victoria.',
  price: 'No dispongo de un precio aprobado para comunicar. Se necesita confirmar el importe actualizado con Victoria.',
  booking: 'La disponibilidad y los cambios de turnos requieren verificación administrativa. No hay una reserva confirmada por esta respuesta.',
  urgent: consultationKnowledge.escalation.urgency,
  professional: 'Para una orientación personalizada se necesita una evaluación profesional. No corresponde indicar un tratamiento por este medio.',
  review: 'Esta pregunta requiere revisión de Victoria; falta información validada suficiente.',
  clarify: '¿Sobre cuál de nuestros servicios te gustaría consultar?',
  unknown: '¿Podés contarnos un poco más sobre lo que necesitás?',
  request: 'La solicitud de información por otro canal queda pendiente de revisión; no se ha realizado ningún envío.',
} as const;
export type GroundedPart = { kind: 'phrase' | 'source'; key: string; text: string; version: string };
export type GroundedOptions = { facts?: readonly ConsultationFact[]; now?: Date; context?: { authorized: boolean; expiresAt: string } };
export const groundedBinding = (input: ConsultationInput, options: GroundedOptions = {}) => createHash('sha256').update(JSON.stringify({ input, context: options.context ?? null })).digest('hex');

/** Read-only source manifest shared by composer and independent checker; no generated text is trusted. */
export function groundedContext(input: ConsultationInput, options: GroundedOptions = {}) {
  if (options.context && (!options.context.authorized || !Number.isFinite(Date.parse(options.context.expiresAt)) || Date.parse(options.context.expiresAt) <= (options.now ?? new Date()).getTime())) throw Error('CONTEXT_UNAUTHORIZED');
  const prepared = prepareConsultationFAQ(input, options), text = normalizeIntelligenceText(input.message);
  const requestChannel = /(?:envia|manda|pasa|informacion).*(?:correo|email)/.test(text) ? 'email' :
    /(?:envia|manda|pasa|informacion).*whatsapp/.test(text) ? 'whatsapp' : null;
  const sources = new Map<string, GroundedPart & { source: string }>();
  for (const result of prepared.results) {
    for (const fact of result.evidence) sources.set(fact.id, { kind: 'source', key: fact.id, version: fact.version, text: fact.fragment, source: fact.source });
  }
  const category = /faciales/.test(text) && !/corporales/.test(text) ? 'faciales' : /corporales/.test(text) && !/faciales/.test(text) ? 'corporales' : null;
  const catalog = prepared.results.flatMap(result => result.catalog);
  if (requestChannel && input.consent && !prepared.decision.professionalReview) catalog.push(...consultationKnowledge.services.map(service => ({ ...service, source: 'src/components/public/serviceDirectory.ts', version: consultationKnowledge.version })));
  for (const service of catalog.filter(service => !category || service.category === category)) {
    sources.set('catalog:' + service.slug, { kind: 'source', key: 'catalog:' + service.slug, version: service.version, text: service.name, source: service.source });
  }
  const pending = prepared.results.filter(result => result.status !== 'evidence_available' && !(requestChannel && sources.size && result.intent === 'personal_contact')).map(result => result.intent);
  const required = new Set<keyof typeof groundedPhrases>();
  if (prepared.decision.professionalReview) required.add(prepared.classification.risks.includes('urgent') ? 'urgent' : prepared.classification.risks.some(risk => ['health','minor','professional_review'].includes(risk)) ? 'professional' : 'review');
  else {
    if (prepared.classification.intents.some(intent => ['pricing','promotions'].includes(intent))) required.add('price');
    if (prepared.classification.intents.some(intent => ['booking','booking_change','hours'].includes(intent))) required.add('booking');
    if (prepared.classification.missing.includes('service')) required.add('clarify');
    if (!prepared.classification.intents.length) required.add('unknown');
    if (pending.length && !required.size) required.add('review');
  }
  if (requestChannel) required.add('request');
  return { prepared, sources: [...sources.values()], pending, required: [...required], requestChannel };
}
