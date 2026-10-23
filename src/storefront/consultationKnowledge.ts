import { serviceGroups, serviceSlug } from '../components/public/serviceDirectory';

/** Approved, versioned facts only; never derive clinical instructions from user messages. */
export const consultationKnowledge = Object.freeze({
  version: '2026-10-23-v1',
  organization: 'Victoriosas | Estética profesional',
  professional: 'Victoria',
  initialStep: 'Evaluación inicial remota',
  contactPolicy: 'El motivo de consulta se escucha y orienta de manera personalizada.',
  clinicalLimit: 'La evaluación inicial remota no sustituye una valoración médica.',
  pricingPolicy: 'No se publican tarifas ni disponibilidad general antes de una evaluación.',
  equipment: ['Punta de diamante', 'Radiofrecuencia', 'Electroporación facial', 'Dermapen'] as const,
  services: serviceGroups.flatMap(group => group.services.map(name => ({
    slug: serviceSlug(name), name, category: group.id,
  }))),
  escalation: {
    urgency: 'Un posible problema urgente de salud requiere derivación a servicios de emergencia, no una respuesta automatizada.',
    clinical: 'No recomendar tratamientos, aparatología ni diagnósticos sin validación profesional.',
    scheduling: 'No prometer ni confirmar horarios o reservas.',
  },
});
export function approvedServiceName(slug: string): string | null {
  return consultationKnowledge.services.find(service => service.slug === slug)?.name ?? null;
}
