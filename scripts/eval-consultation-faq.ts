// Offline synthetic evaluation: no database, model, credential or communication.
import { composeGroundedConsultation } from '../src/storefront/consultationGroundedComposer';
import { reviewGroundedConsultation } from '../src/storefront/consultationGroundedGuardian';
import { consultationFAQCorpus } from '../src/storefront/consultationFAQCorpus';
import { consultationFAQContrastCases, consultationFAQNegativeCases } from '../src/storefront/consultationFAQCases';
import { classifyConsultationFAQ, prepareConsultationFAQ, FAQ_VERSION } from '../src/storefront/consultationFAQ';
import type { ConsultationInput } from '../src/storefront/consultationRequest';
const input = (message: string): ConsultationInput => ({ id: '11111111-1111-4111-8111-111111111111', fullName: 'Caso sintético', phone: '00000000', email: '', age: null, service: 'orientacion', message, responseChannel: 'whatsapp', consent: true, consentVersion: 'consultation-v1', website: '' });
const failures: string[] = [];
let examples = 0;
for (const entry of consultationFAQCorpus) for (const message of entry.question_examples) {
  examples++;
  if (classifyConsultationFAQ(input(message)).primary !== entry.intent) failures.push(entry.id);
}
for (const [index, [message, expected]] of consultationFAQContrastCases.entries()) {
  if (JSON.stringify(classifyConsultationFAQ(input(message)).intents) !== JSON.stringify(expected)) failures.push('contrast-' + (index + 1));
}
for (const [index, example] of consultationFAQNegativeCases.entries()) {
  const result = prepareConsultationFAQ(input(example.message));
  if (!result.classification.risks.includes(example.risk) || result.decision.action !== 'no_send' || result.results.some(answer => answer.evidence.length || answer.catalog.length)) failures.push('negative-' + (index + 1));
}
if (process.argv.includes('--grounded')) {
  const messages = [...consultationFAQCorpus.flatMap(entry => [...entry.question_examples]), ...consultationFAQContrastCases.map(([message]) => message), ...consultationFAQNegativeCases.map(example => example.message)];
  for (const [index, message] of messages.entries()) {
    const question = input(message), draft = composeGroundedConsultation(question), review = reviewGroundedConsultation(question, draft);
    if (draft.delivery_decision !== 'no_send' || review.delivery_decision !== 'no_send' || review.codes.some(code => !['REQUIRES_PRIVATE_REVIEW'].includes(code))) failures.push('grounded-' + (index + 1));
  }
}
console.log(JSON.stringify({ version: FAQ_VERSION, intents: consultationFAQCorpus.length, examples,
  grounded: process.argv.includes('--grounded'), contrasts: consultationFAQContrastCases.length, negatives: consultationFAQNegativeCases.length,
  failures, action: 'no_send', remoteCalls: 0, scope: 'authored_synthetic_cases_not_generalization_accuracy' }, null, 2));
process.exitCode = failures.length ? 1 : 0;
