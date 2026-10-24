import type { ConsultationInput } from './consultationRequest';
import { approvedServiceName } from './consultationKnowledge';
import { serviceDetails } from '../components/public/serviceDetails';
import { draftConsultationResponse } from './consultationResponseAgents';

export type AnswerOption = { id: 'personalizada' | 'breve' | 'orientacion'; title: string; text: string };
export type AnswerPlan = { options: AnswerOption[]; needsVictoria: boolean; reason: string; matchedService: string | null };

const normalize = (text: string) => text.toLocaleLowerCase('es-UY').normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const risk = /embaraz|lactan|medic|alerg|dermat|cirug|herid|infecc|menor|hij[oa]|dolor|enfermedad|diagnost|urgenc|sangrad|riesgo|contraindic|efectiv|garantiz|seguro para|lunar|lesion|acne|estrias|salud/i;
const serviceWords = (name: string) => normalize(name).split(/\s+/).filter(word => word.length > 4 && !['tratamiento','profunda','facial','masaje','hidratacion'].includes(word));

export function prepareAnswerOptions(input: ConsultationInput): AnswerPlan {
  const base = draftConsultationResponse(input);
  const message = normalize(input.message);
  const selected = approvedServiceName(input.service);
  const identified = Object.keys(serviceDetails).filter(name => serviceWords(name).some(word => message.includes(word)));
  const ambiguous = identified.length > 1 && !(selected && identified.includes(selected));
  const service = ambiguous ? null : identified[0] || (input.service !== 'orientacion' ? selected : null);
  const isRisk = base.priority !== 'normal' || risk.test(message);
  const price = /precio|cuanto (sale|cuesta)|tarifa|valor|presupuesto|costo/.test(message);
  const booking = /turno|agenda|horario|reserv|disponib/.test(message);
  const unknown = !service && !price && !booking && !/informacion|consulta|orientacion|servicios/.test(message);
  const needsVictoria = isRisk || ambiguous || unknown;
  const reason = isRisk ? 'La consulta menciona salud, seguridad, eficacia o una situación que requiere evaluación humana.'
    : ambiguous ? 'Se mencionan varios servicios y no es seguro cuál interesa.'
    : unknown ? 'La información aprobada no permite responder con precisión a esta pregunta.'
    : '';
  const signature = '\n\nVictoria | Victoriosas';
  const welcome = 'Hola, gracias por escribirnos.';
  const intro = service ? ' Sobre ' + service.toLowerCase() + ': ' + serviceDetails[service].description.split('.')[0].toLowerCase() + '.' : '';
  const main = needsVictoria
    ? 'Tu consulta necesita una revisión personal de Victoria antes de darte una respuesta precisa. La evaluación inicial remota no sustituye una valoración médica.'
    : price ? 'El valor se define después de la evaluación inicial remota, según el cuidado que corresponda. No publicamos tarifas generales.'
    : booking ? 'Los horarios se coordinan personalmente después de conversar con Victoria; por aquí no confirmamos reservas.'
    : 'Empezamos por una evaluación inicial remota para escucharte y orientarte sobre los próximos pasos.';
  const next = ' ¿Te gustaría coordinar una conversación inicial con Victoria?';
  const options: AnswerOption[] = [
    { id: 'personalizada', title: 'Personalizada', text: welcome + (needsVictoria ? '' : intro) + '\n\n' + main + (needsVictoria ? '' : next) + signature },
    { id: 'breve', title: 'Breve', text: welcome + '\n\n' + main + signature },
    { id: 'orientacion', title: 'Orientación inicial', text: welcome + '\n\n' + (needsVictoria ? main : 'Victoria puede escucharte en una evaluación inicial remota y explicarte los pasos adecuados para tu consulta, sin comprometer resultados ni horarios.') + signature },
  ];
  return { options, needsVictoria, reason, matchedService: service };
}

export function validateApprovedAnswer(text: string): string | null {
  if (typeof text !== 'string' || text.trim().length < 20 || text.length > 2000) return 'invalid_length';
  if (!text.trim().endsWith('Victoria | Victoriosas')) return 'signature_required';
  if (/\$\s*\d|\b(?:UYU|USD)\s*\d/i.test(text)) return 'prices_require_review';
  if (/garantiz(?:amos|ado)|sin dolor|elimina(?:mos)? (?:arrugas|manchas|estrias)|turno confirmado|reserva confirmada/i.test(normalize(text))) return 'unsafe_claim';
  return null;
}
