import type { ConsultationRecord } from './consultationSupabase';
export const intelligenceFixture = (message = 'Precio del masaje relax'): ConsultationRecord => ({
 id:'88888888-8888-4888-8888-888888888888', created_at:'2026-10-24T00:00:00Z', expires_at:'2026-11-20T00:00:00Z',
 input:{id:'88888888-8888-4888-8888-888888888888',fullName:'Caso sintético',phone:'+59899123456',email:'synthetic@example.com',age:30,service:'orientacion',message,responseChannel:'email',consent:true,consentVersion:'consultation-v1',aiConsent:true,website:''},
});
