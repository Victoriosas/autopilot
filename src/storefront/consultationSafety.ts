/** Conservative triage only: terms trigger human review, never a clinical recommendation. */
export function normalizeConsultationText(value: string): string {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/\s+/g, ' ').trim();
}

const urgentTerms = /\b(?:suicid\w*|autolesion\w*|no puedo respirar|dificultad (?:para )?respirar|dolor (?:fuerte|intenso) en el pecho|reaccion alergica grave|anafilaxia|desmayo|sangrado abundante)\b/;
const sensitiveTerms = /\b(?:embaraz\w*|lactan\w*|amamanta\w*|medic\w*|antibiotic\w*|alerg\w*|enfermed\w*|cirug\w*|operad\w*|operaron|herid\w*|infecc\w*|lunar(?:es)?|dolor\w*|diagnost\w*|dermatitis|rosacea|acne|cancer|quemadur\w*|manchas sospechosas|efectiv\w*|eficac\w*|funciona\w*|segur\w*|riesgo\w*|contraindic\w*|menor\w*|hij[oa]s?|nina?s?|ninos?|adolescen\w*)\b/;

export function consultationRisk(message: string, age: number | null): 'normal' | 'review' | 'urgent' {
  const text = normalizeConsultationText(message);
  if (urgentTerms.test(text)) return 'urgent';
  if (sensitiveTerms.test(text) || age !== null && age < 18) return 'review';
  return 'normal';
}

export function isTestConsultation(name: string, message: string, phone: string): boolean {
  const text = normalizeConsultationText(name + ' ' + message);
  const digits = phone.replace(/\D/g, '');
  return /\b(?:prueb\w*|test\w*|config\w*|simulaci\w*|demo)\b/.test(text) ||
    /(\d)\1{6}/.test(digits) || /01234567|12345678|23456789|98765432|87654321/.test(digits);
}
