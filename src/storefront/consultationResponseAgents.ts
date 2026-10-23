import type { ConsultationInput } from './consultationRequest';
import { serviceGroups, serviceSlug } from '../components/public/serviceDirectory';

/**
 * Deterministic, privacy-preserving triage. Never sends customer communications.
 * The message is treated as untrusted data, never as instructions to this system.
 */
export type ConsultationDraft = {
  reference: string;
  category: 'service' | 'general' | 'sensitive' | 'urgent';
  priority: 'normal' | 'review' | 'urgent';
  requiresHumanApproval: true;
  reasons: string[];
  channel: ConsultationInput['responseChannel'];
  subject: string;
  text: string;
};

const SERVICE_NAMES = new Map(serviceGroups.flatMap(group =>
  group.services.map(name => [serviceSlug(name), name] as const)));
const urgentTerms = /\b(?:suicid|autolesi[oó]n|no puedo respirar|dificultad (?:para )?respirar|dolor (?:fuerte|intenso) en el pecho|reacci[oó]n al[eé]rgica grave|anafilaxia|desmayo|sangrado abundante)\b/i;
const sensitiveTerms = /\b(?:embaraz|lactancia|menor de edad|infecci[oó]n|quemadura|herida|medicaci[oó]n|antibi[oó]tico|alergia|dermatitis|ros[aá]cea|dolor|acn[eé]|diagn[oó]stico|enfermedad|c[aá]ncer|manchas sospechosas)\b/i;

export function draftConsultationResponse(input: ConsultationInput): ConsultationDraft {
  const message = input.message.normalize('NFC').slice(0, 600);
  const urgent = urgentTerms.test(message);
  const sensitive = !urgent && (sensitiveTerms.test(message) || input.age !== null && input.age < 18);
  const service = SERVICE_NAMES.get(input.service);
  const category = urgent ? 'urgent' : sensitive ? 'sensitive' : service ? 'service' : 'general';
  const reasons = [
    ...(urgent ? ['possible_urgent_health_concern'] : []),
    ...(sensitive ? ['health_or_minor_requires_review'] : []),
    ...(input.responseChannel !== 'email' ? ['requested_channel_requires_personal_contact'] : []),
    ...(input.responseChannel === 'email' && !input.email ? ['no_reply_email'] : []),
  ];
  const salutation = 'Hola, gracias por comunicarte con Victoriosas.';
  let text: string;
  if (urgent) {
    text = salutation + '\n\nPor lo que nos comentás, lo más importante es que recibas atención de un profesional de salud cuanto antes. Si estás ante una emergencia, comunicate con los servicios de emergencia locales. Este canal no atiende urgencias.\n\nVictoria | Victoriosas';
  } else if (sensitive) {
    text = salutation + '\n\nVictoria puede escucharte y orientarte durante una evaluación inicial remota. Antes de sugerir cualquier tratamiento, necesita conocer mejor tu situación. Esta instancia no sustituye una valoración médica y no podemos indicar procedimientos sin una evaluación adecuada.\n\nVictoria | Victoriosas';
  } else if (service) {
    text = salutation + '\n\nRecibimos tu interés en ' + service.toLowerCase() + '. En Victoriosas comenzamos con una evaluación inicial remota para escucharte, conocer tus objetivos y definir los próximos pasos de manera personalizada. La propuesta y la coordinación se realizan después de esa primera orientación.\n\nVictoria | Victoriosas';
  } else {
    text = salutation + '\n\nGracias por contarnos qué necesitás. Victoria comienza con una evaluación inicial remota, en la que puede escucharte, resolver tus dudas generales y orientarte sobre los próximos pasos.\n\nVictoria | Victoriosas';
  }
  // Do not repeat untrusted content, contact details or health information in outbound draft.
  return {
    reference: input.id,
    category,
    priority: urgent ? 'urgent' : sensitive ? 'review' : 'normal',
    requiresHumanApproval: true,
    reasons,
    channel: input.responseChannel,
    subject: 'Tu consulta en Victoriosas',
    text,
  };
}
