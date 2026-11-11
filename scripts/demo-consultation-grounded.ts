// Local synthetic demonstration only. No model, delivery, database or credential.
import { composeGroundedConsultation } from '../src/storefront/consultationGroundedComposer';
import { reviewGroundedConsultation } from '../src/storefront/consultationGroundedGuardian';
import type { ConsultationInput } from '../src/storefront/consultationRequest';
if (!process.argv.includes('--synthetic')) throw Error('SYNTHETIC_OPT_IN_REQUIRED');
const index = process.argv.indexOf('--question');
const message = index < 0 ? 'Hola, ¿qué servicios faciales tienen?' : process.argv[index + 1];
if (!message?.trim() || message.length > 600) throw Error('SYNTHETIC_QUESTION_INVALID');
const input: ConsultationInput = { id: '11111111-1111-4111-8111-111111111111', fullName: 'Caso sintético', phone: '00000000', email: '', age: null, service: 'orientacion', message, responseChannel: 'whatsapp', consent: true, consentVersion: 'consultation-v1', website: '' };
const draft = composeGroundedConsultation(input);
console.log(JSON.stringify({ draft, review: reviewGroundedConsultation(input, draft), synthetic: true }, null, 2));
