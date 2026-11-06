import type { ConsultationFact } from './consultationEvidence';

// Exact, complete disclaimers only. Do not infer negation with a broad regex:
// an arbitrary clause after "no garantiza" could contain a real promise/fee.
// The original fragment remains intact in the evidence and in the draft.
const safeDisclaimers = new Set([
  'Técnicas, duración, sesiones, frecuencia, precio y disponibilidad se confirman personalmente.',
  'No equivale a tratar una enfermedad ni garantiza cerrar poros.',
  'Los cambios posibles dependen de la evaluación y no equivalen a rejuvenecimiento médico ni resultados garantizados.',
  'No equivale a cirugía ni garantiza tensado, duración del efecto o cambios estructurales.',
  'No trata enfermedades oculares ni garantiza eliminar ojeras o bolsas.',
  'No equivale a toxina botulínica, rellenos ni procedimientos médicos y no garantiza borrar arrugas.',
  'No es tratamiento para obesidad ni garantiza reducir grasa, peso, centímetros o celulitis.',
  'Son cambios cicatriciales de la piel; no se garantiza su eliminación ni un porcentaje de mejora.',
]);

export function unsafeConsultationFact(fact: ConsultationFact): boolean {
  // Keep punctuation and unrecognized sentences so an appended/embedded claim
  // cannot inherit a disclaimer's exception. Unknown wording fails closed.
  const inspected = (fact.fragment.match(/[^.!?\n]+[.!?\n]?/g) ?? [])
    .filter(sentence => !safeDisclaimers.has(sentence.trim()))
    .join(' ');
  return /(?:\$|\b(?:USD|UYU|EUR)\b|\d[\d.,]*\s*pesos|garanti[cz]|guarantee|100\s*%|sin riesgos|te (?:recomiendo|indico)|en tu caso|debes (?:usar|aplicar))/i.test(inspected) ||
    fact.topic === 'service' && /precio|tarifa|cuesta|pesos|d[oó]lares/i.test(inspected);
}
