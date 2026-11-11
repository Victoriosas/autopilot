import { consultationFAQCorpus } from './consultationFAQCorpus';
import { normalizeIntelligenceText, understandConsultation } from './consultationUnderstanding';
import { consultationKnowledge } from './consultationKnowledge';
import { approvedConsultationFacts, currentFacts, type ConsultationFact } from './consultationEvidence';
import { unsafeConsultationFact } from './consultationEvidencePolicy';
import type { ConsultationInput } from './consultationRequest';
import type { ServiceKnowledgeStore } from './consultationServiceKnowledge';

export const FAQ_VERSION = 'consultation-faq-v1';
export type FAQIntent = typeof consultationFAQCorpus[number]['intent'];
export const consultationFAQTaxonomy = consultationFAQCorpus.map(({ question_examples, ...entry }) => entry);

// Bounded administrative recognition, not semantic certainty or model training.
// Rules do not read the evaluation corpus or use its examples as answer facts.
const rules: Record<FAQIntent, RegExp> = {
  greeting: /\b(hola+a*|buenas+s*|buen dia|buenas tardes|buenas noches|primer contacto)\b/,
  organization: /que es victoriosas|sobre victoriosas|a que se dedican|quien es victoria|conocer victoriosas|como trabajan|tipo de centro|sobre ustedes|informacion general de victoriosas|que hacen en victoriosas/,
  services: /que (?:servicios|tratamientos|opciones)|servicios (?:ofrecen|disponibles|tienen)|opciones (?:tienen|corporales|de asesoria)|tienen algo para|trabajan con masajes|catalogo|lista de servicios/,
  service_description: /en que consiste|explicas (?:ese|el)|que incluye|como es el|de que se trata|informacion sobre|que se hace|como funciona|describis|detalles del/,
  pricing: /pres?cios?|precios?|presios?|presupuesto|cuanto (?:cuesta|sale)|costo|tarifa|valor/,
  promotions: /\bpromo\w*|descuento|oferta/,
  hours: /sabados?|domingos?|lunes|horarios?|que dias|hora (?:abren|cierran)|atienden de|abiertos/,
  location: /donde (?:estan|queda)|direccion|ubicacion|como llego|para llegar|que zona|por donde/,
  booking: /reservar|disponibilidad|agendar|coordinar una reserva|hora para|lugar (?:libre|para)|pedir una cita|saco hora|turnos? disponibles/,
  booking_change: /cambiar.*(?:turno|reserva)|cancel|reprogram|mover la hora|no puedo ir|modificar.*cita|anular|postergar/,
  duration: /cuanto dura|duracion|cuanto tiempo|cuanto demora|largo el servicio|cuantos minutos|tiempo debo disponer|cuanto se tarda/,
  preparation: /prepar|antes de (?:ir|la|una)|que debo llevar|sin maquillaje|como debo ir|indicaciones.*antes/,
  care: /cuidar|cuidado (?:general|facial|de la piel|personal)|cuidados (?:generales|basicos)|para cuidarme|guias de cuidado/,
  skin: /piel (?:muy )?(?:seca|sensible|grasa|mixta|se irrita|tirante)|mi piel|tengo (?:acne|rosacea|manchas)|granitos/,
  professional_review: /embaraz|contraindic|medicacion|amamant|cirugia|adecuado para mi|evaluacion profesional|alerg|restriccion|soy menor|tratamiento.*para mi/,
  payment: /(?:medios|metodos|formas) de pago|pagar|abonar|aceptan (?:efectivo|debito|credito)|cuotas/,
  gift: /regal|obsequio|gift card/,
  personal_contact: /no se que.*elegir|pueden orientar|opcion para empezar|hablar con|me pueden llamar|whatsapp|por correo|atencion personalizada|ayudan a elegir|contactar a victoria/,
  follow_up: /recibieron|escribi ayer|revisar mi solicitud|agregar informacion|estado.*consulta|esperando.*respuesta|mande.*formulario|seguimiento|mensaje anterior|ampliar.*consulta/,
  complaint_privacy: /reclam|borr.*datos|queja|problema con la atencion|privacidad|consentimiento|ver mis datos|no autorice|devolucion|otras? client[ae]s|correos.*client|datos privados|claves|api.key/,
};

export function classifyConsultationFAQ(input: ConsultationInput) {
  if (typeof input.message !== 'string' || input.message.length > 600) throw Error('FAQ_INPUT_INVALID');
  const text = normalizeIntelligenceText(input.message);
  const understood = understandConsultation(input);
  let matches = consultationFAQTaxonomy.filter(entry => rules[entry.intent].test(text));
  if (matches.length > 1) matches = matches.filter(entry => entry.intent !== 'greeting');
  // A care object inside a catalogue question is not an additional care request.
  if (matches.some(entry => entry.intent === 'services') && !/ademas|tambien|y quiero/.test(text)) matches = matches.filter(entry => entry.intent !== 'care');
  matches.sort((a,b) => (text.search(rules[a.intent]) - text.search(rules[b.intent])) || a.id.localeCompare(b.id));
  const aliases: [RegExp, string][] = [
    [/limpieza facial/, 'higiene-y-limpieza-facial'], [/limpieza profunda/, 'limpieza-profunda'],
    [/masaje relajante/, 'masaje-relax'], [/masaje de relajacion/, 'masaje-relax'],
  ];
  const named = consultationKnowledge.services.filter(service => text.includes(normalizeIntelligenceText(service.name))).map(service => service.slug);
  const services = [...new Set([...named, ...aliases.filter(([pattern]) => pattern.test(text)).map(([,slug]) => slug)])];
  const candidates = services.length ? services : understood.serviceCandidates;
  const unsupported = /\b(botox|mesoterapia|depilacion|laser)\b/.test(text);
  const risks = [...new Set([...understood.risks,
    ...(matches.some(entry => ['skin','professional_review'].includes(entry.intent)) ? ['professional_review'] : []),
    ...(matches.some(entry => entry.intent === 'complaint_privacy') ? ['privacy_or_complaint'] : []),
    ...(unsupported ? ['unsupported_service'] : []),
    ...(candidates.length > 1 ? ['ambiguous_service'] : []),
  ])];
  const requiresService = matches.some(entry => ['pricing','service_description','duration','preparation'].includes(entry.intent));
  return { version: FAQ_VERSION, primary: matches[0]?.intent ?? 'unknown', intents: matches.map(entry => entry.intent),
    taxonomyIds: matches.map(entry => entry.id), serviceCandidates: unsupported ? [] : candidates,
    missing: [...(!matches.length ? ['intent'] : []), ...(requiresService && candidates.length !== 1 ? ['service'] : [])],
    risks, requiresHumanReview: true as const, recognition: 'deterministic_rules_not_calibrated' as const };
}

const trustedSource = (source: string) => /^src\/storefront\/consultationKnowledge\.ts#[a-z-]+$/.test(source) ||
  /^src\/components\/public\/serviceDetails\.ts#[a-z0-9-]+$/.test(source) || /^Supabase beauty_services\/[a-z0-9-]+\/knowledge\/\d+$/.test(source);

/** Choose newest revisions BEFORE approval/expiry filtering, never revive a revoked or expired approval. */
export function currentFAQFacts(facts: readonly ConsultationFact[], now: Date) {
  if (!Number.isFinite(now.getTime())) throw Error('FAQ_TIME_INVALID');
  const invalidIds = new Set(facts.filter(fact => !fact.version?.trim() || !Number.isFinite(Date.parse(fact.reviewedAt)) ||
    !Number.isFinite(fact.authority) || fact.validUntil !== null && (typeof fact.validUntil !== 'string' || !Number.isFinite(Date.parse(fact.validUntil)))).map(fact => fact.id));
  const latest = facts.filter(fact => !facts.some(other => other.id === fact.id &&
    (other.authority > fact.authority || other.authority === fact.authority &&
      (Date.parse(other.reviewedAt) > Date.parse(fact.reviewedAt) ||
        Date.parse(other.reviewedAt) === Date.parse(fact.reviewedAt) && /^\d+$/.test(other.version) && /^\d+$/.test(fact.version) && Number(other.version) > Number(fact.version)))));
  // A contradictory approval at the same latest revision must also fail closed.
  const withdrawnIds = new Set(latest.filter(fact => fact.approval !== 'approved').map(fact => fact.id));
  const conflictIds = new Set(latest.filter(fact => latest.some(other => other.id === fact.id &&
    other.authority === fact.authority && Date.parse(other.reviewedAt) === Date.parse(fact.reviewedAt) &&
    (other.fragment !== fact.fragment || other.version !== fact.version))).map(fact => fact.id));
  const current = currentFacts(latest.filter(fact => !invalidIds.has(fact.id) && !withdrawnIds.has(fact.id) && !conflictIds.has(fact.id)), now);
  return { ...current, conflicts: [...new Set([...current.conflicts, ...conflictIds])], facts: current.facts.filter(fact => Boolean(fact.version) && trustedSource(fact.source) && !unsafeConsultationFact(fact)) };
}

const topics: Partial<Record<FAQIntent, string>> = { organization: 'general', service_description: 'service', care: 'general' };
export function prepareConsultationFAQ(input: ConsultationInput, options: { facts?: readonly ConsultationFact[]; now?: Date } = {}) {
  const classification = classifyConsultationFAQ(input);
  const now = options.now ?? new Date();
  if (!Number.isFinite(now.getTime())) throw Error('FAQ_TIME_INVALID');
  const current = currentFAQFacts(options.facts ?? approvedConsultationFacts, now);
  const blocked = classification.risks.length > 0 || !input.consent || current.conflicts.length > 0;
  const results = classification.intents.map(intent => {
    // Prices, hours and booking require capabilities/facts absent in the current approved store.
    const evidence = blocked ? [] : current.facts.filter(fact => topics[intent] && fact.topic === topics[intent] &&
      (fact.topic !== 'service' || classification.serviceCandidates.length === 1 && fact.service === classification.serviceCandidates[0]));
    const catalog = intent === 'services' && !blocked ? consultationKnowledge.services.map(service => ({ ...service,
      source: 'src/components/public/serviceDirectory.ts', version: consultationKnowledge.version })) : [];
    const available = evidence.length > 0 || catalog.length > 0;
    const missingService = classification.missing.includes('service') && ['pricing','duration','preparation','service_description'].includes(intent);
    return { intent, evidence, catalog, status: available ? 'evidence_available' as const : 'human_review_required' as const,
      fallback: available ? null : missingService && !blocked ? '¿Sobre cuál de nuestros servicios te gustaría consultar?'
        : 'No dispongo de información profesional validada para responder esta pregunta. La consulta requiere revisión de Victoria.' };
  });
  return { version: FAQ_VERSION, classification, results, knowledgeConflicts: current.conflicts,
    fallback: results.length ? null : blocked ? 'Esta consulta requiere revisión humana; no hay una respuesta automática habilitada.' : '¿Podés contarnos un poco más sobre lo que necesitás?',
    decision: { action: 'no_send' as const, requiresHumanReview: true as const, professionalReview: blocked },
  };
}

/** Production integration boundary: use the existing approved-facts RPC, never accept facts from model/user output. */
export async function prepareConsultationFAQFromStore(input: ConsultationInput, store: Pick<ServiceKnowledgeStore, 'facts'>, now = new Date()) {
  try { return { ...prepareConsultationFAQ(input, { facts: await store.facts(), now }), knowledgeAvailable: true }; }
  catch { return { ...prepareConsultationFAQ(input, { facts: [], now }), knowledgeAvailable: false }; }
}
