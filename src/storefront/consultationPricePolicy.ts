import type { ConsultationInput } from './consultationRequest';
import { approvedServiceName, consultationKnowledge } from './consultationKnowledge';
import { consultationRisk, isTestConsultation, normalizeConsultationText } from './consultationSafety';

/** Complete allowlisted grammar, not a model confidence score or a keyword-only filter. */
export function classifyPriceInquiry(input: ConsultationInput): { service: string | null } | null {
  if (input.responseChannel !== 'email' || !input.email || input.consent !== true ||
      !Number.isInteger(input.age) || input.age === null || input.age < 18 || input.age > 120 ||
      input.message.length > 160 || consultationRisk(input.message, input.age) !== 'normal' ||
      isTestConsultation(input.fullName, input.message, input.phone)) return null;
  const selected = input.service === 'orientacion' ? null : input.service;
  if (selected && !approvedServiceName(selected)) return null;
  const text = normalizeConsultationText(input.message)
    .replace(/[¿?¡!,.;:]/g, ' ').replace(/\s+/g, ' ').trim()
    .replace(/(?:^| )por favor$/, '').trim()
    .replace(/^(?:hola|buen dia|buenas(?: tardes| noches)?)(?:\s+|$)/, '')
    .replace(/^(?:(?:quisiera|quiero|queria|me gustaria) (?:saber|consultar|conocer)|me (?:pasas|podes (?:decir|pasar)|podrias (?:decir|pasar)))(?:\s+|$)/, '')
    .replace(/^(?:los|las|el|la|un)\s+/, '');
  const match = /^(?:precios?|valor(?:es)?|tarifas?|costos?|presupuesto|cuanto (?:sale|cuesta|salen|cuestan))(?: (.+))?$/.exec(text);
  if (!match) return null;
  const target = (match[1] || '').replace(/^(?:de|para)(?: (?:los|las|el|la|un|una))? /, '')
    .replace(/^del /, '').replace(/^(?:los|las|el|la|un|una) /, '');
  if (!target || /^(?:tratamientos|servicios)$/.test(target)) return { service: selected };
  const service = consultationKnowledge.services.find(item => normalizeConsultationText(item.name) === target);
  if (!service || selected && selected !== service.slug) return null;
  return { service: service.slug };
}

type PriceReply = { subject: string; text: string };
export function buildAutomaticPriceReply(service: string | null): PriceReply | null {
  if (service !== null && !approvedServiceName(service)) return null;
  const link = service ? '\n\nServicio consultado: https://victoriosas.online/nuestros-servicios#' + service : '';
  return {
    subject: 'Tu consulta en Victoriosas',
    text: 'Hola, gracias por escribirnos 🤍 Cada piel y cada cuerpo son distintos, por eso las tarifas las armamos de forma personal. Lo primero es una evaluación inicial remota con Victoria, donde te escucha y te cuenta qué te conviene. Después te pasamos una propuesta clara, sin sorpresas. ¿Te coordino un horario para esa charla?' + link + '\n\nVictoria | Victoriosas',
  };
}

/** Guardian: only a trusted, fixed M1 and optional approved link can leave this automatic path.
 * Exact equality excludes injected content, personal details, prices, claims and extra CTAs.
 * Durable uniqueness is checked separately by the outbox before contacting the provider.
 */
export function guardAutomaticPriceReply(reply: PriceReply, service: string | null): boolean {
  const approved = buildAutomaticPriceReply(service);
  return Boolean(approved && reply.subject === approved.subject && reply.text === approved.text &&
    reply.text.split(/\s+/).length < 120 && !/\d|\$|%/.test(reply.text) &&
    (reply.text.match(/\?/g) || []).length === 1 && reply.text.endsWith('Victoria | Victoriosas'));
}
