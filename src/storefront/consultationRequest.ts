import { serviceGroups, serviceSlug } from '../components/public/serviceDirectory';

export const CONSULTATION_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export type ConsultationInput = { id: string; fullName: string; phone: string; email: string; age: number | null; service: string; message: string; responseChannel: 'whatsapp' | 'email' | 'phone'; consent: true; consentVersion: 'consultation-v1'; aiConsent?: boolean; website: '' };
const services = new Set<string>(['orientacion', ...serviceGroups.flatMap(group => group.services.map(serviceSlug))]);
export function normalizeConsultationRequest(value: unknown): ConsultationInput {
  const invalid = () => { throw Error('CONSULTATION_INPUT_INVALID'); };
  if (!value || typeof value !== 'object' || Array.isArray(value)) return invalid();
  const b = value as Record<string, unknown>;
  const keys = ['id', 'fullName', 'phone', 'email', 'age', 'service', 'message', 'responseChannel', 'consent', 'consentVersion', 'aiConsent', 'website'];
  if (Object.keys(b).some(key => !keys.includes(key)) || b.consent !== true || b.consentVersion !== 'consultation-v1' || (b.aiConsent !== undefined && typeof b.aiConsent !== 'boolean') || b.website !== '') return invalid();
  const text = (key: string, max: number, required = true) => {
    if (typeof b[key] !== 'string') return invalid();
    const result = (b[key] as string).replace(/\r\n/g, '\n').trim();
    const forbidden = key === 'message' ? /[\x00-\x09\x0b-\x1f\x7f<>\u202a-\u202e\u2066-\u2069]/ : /[\x00-\x1f\x7f<>\u202a-\u202e\u2066-\u2069]/;
    if ((required && !result) || result.length > max || forbidden.test(result)) return invalid();
    return result;
  };
  const id = text('id', 36).toLowerCase(), fullName = text('fullName', 120), phone = text('phone', 25), email = text('email', 254, false).toLowerCase(), service = text('service', 80), message = text('message', 600);
  if (!CONSULTATION_UUID.test(id) || !services.has(service) || !/^\+?[\d ()-]{8,25}$/.test(phone) || phone.replace(/\D/g, '').length < 8 || phone.replace(/\D/g, '').length > 15 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email))) return invalid();
  if (b.age !== null && (typeof b.age !== 'number' || !Number.isInteger(b.age) || b.age < 0 || b.age > 120)) return invalid();
  if (!['whatsapp', 'email', 'phone'].includes(b.responseChannel as string) || (b.responseChannel === 'email' && !email)) return invalid();
  return { id, fullName, phone, email, age: b.age as number | null, service, message, responseChannel: b.responseChannel as ConsultationInput['responseChannel'], consent: true, consentVersion: 'consultation-v1', ...(b.aiConsent === undefined ? {} : { aiConsent: b.aiConsent as boolean }), website: '' };
}
