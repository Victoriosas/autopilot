import type { ConsultationInterest } from '../components/public/ContactLink';

export type CareCategory = 'online' | 'faciales' | 'corporales' | 'masajes';
export type CareFilter = 'todos' | CareCategory;
export type CareService = {
  id: string; category: CareCategory; name: string; summary: string; detail: string;
  modality: string; status: 'draft' | 'published'; interest: ConsultationInterest;
  audience: string; includes: readonly string[]; exclusions: readonly string[];
  steps: readonly string[]; priceUYU: number | null; durationMinutes: number | null;
  image: string; imageAlt: string; invitation: string; action: string;
};
export const careCategories: readonly { id: CareFilter; label: string }[] = [
  { id: 'todos', label: 'Todos' }, { id: 'online', label: 'Online' },
  { id: 'faciales', label: 'Faciales' }, { id: 'corporales', label: 'Corporales' },
  { id: 'masajes', label: 'Masajes' },
];
const steps = ['Contanos qué te gustaría cuidar por WhatsApp o email.', 'Coordinamos una evaluación inicial remota para conversar sobre las opciones.', 'Antes de confirmar, acordamos personalmente la propuesta, las tarifas y la disponibilidad.'];
const exclusions = ['No incluye diagnósticos ni tratamientos médicos.', 'La consulta desde la web no confirma una reserva.'];
export const careServices: readonly CareService[] = [
  {
    id: 'facial', category: 'faciales', name: 'Estética facial', interest: 'facial', status: 'published',
    invitation: 'Escuchar tu piel.', action: 'Consultar por facial',
    summary: 'Un cuidado que parte de cómo sientes tu piel y de lo que te gustaría atender. La orientación se define contigo.',
    detail: 'Conversamos sobre lo que buscás para tu cuidado facial y las dudas que te gustaría aclarar. La propuesta se define de forma personal, después de escucharte.',
    audience: 'Para quienes quieren explorar opciones de cuidado facial sin tener que elegir una técnica antes de conversar.',
    includes: ['Conversación sobre tus objetivos de cuidado facial.', 'Orientación inicial para acordar los próximos pasos.'],
    modality: 'Evaluación inicial remota; modalidad de atención acordada personalmente.',
    exclusions, steps, priceUYU: null, durationMinutes: null,
    image: '8a000.png', imageAlt: 'Imagen evocadora de cuidado facial',
  },
  {
    id: 'corporal', category: 'corporales', name: 'Estética corporal', interest: 'corporal', status: 'published',
    invitation: 'Habitarte con calma.', action: 'Consultar por corporal',
    summary: 'Un espacio para prestar atención a tu cuerpo, conversar sobre tus objetivos y explorar el cuidado adecuado para ti.',
    detail: 'Un primer espacio para hablar de tus preferencias y de lo que esperás de un cuidado corporal. Consultá las opciones y sus condiciones antes de decidir.',
    audience: 'Para quienes buscan un momento de cuidado corporal y prefieren recibir orientación antes de elegir.',
    includes: ['Escucha de tus preferencias de cuidado corporal.', 'Una propuesta personal con sus condiciones antes de confirmar.'],
    modality: 'Evaluación inicial remota; modalidad de atención acordada personalmente.',
    exclusions: [...exclusions, 'No se prometen cambios de peso, medidas ni resultados garantizados.'],
    steps, priceUYU: null, durationMinutes: null,
    image: 'dde65.png', imageAlt: 'Imagen evocadora de una pausa de cuidado corporal',
  },
  {
    id: 'masajes', category: 'masajes', name: 'Masajes', interest: 'relajacion', status: 'published',
    invitation: 'Regalarte una pausa.', action: 'Consultar por masajes',
    summary: 'Tiempo para bajar el ritmo y conectar con tu bienestar. Conversamos sobre tus preferencias antes de coordinar.',
    detail: 'Una invitación a hacer una pausa. Antes de coordinar, conversamos sobre la experiencia que buscás y las opciones disponibles para vos.',
    audience: 'Para quienes desean dedicar un momento a su bienestar y conocer las opciones de masajes.',
    includes: ['Conversación previa sobre tus preferencias.', 'Coordinación personal de la atención y sus condiciones.'],
    modality: 'Evaluación inicial remota; modalidad de atención acordada personalmente.',
    exclusions: [...exclusions, 'No se ofrece tratamiento de lesiones ni se prometen efectos terapéuticos.'],
    steps, priceUYU: null, durationMinutes: null,
    image: 'ae5d6.png', imageAlt: 'Imagen evocadora de un masaje de bienestar',
  },
  {
    id: 'asesoria-online', category: 'online', name: 'Asesoría de cuidado facial online', interest: 'online', status: 'draft',
    invitation: 'Tu rutina, con más claridad.', action: 'Consultar por asesoría online',
    summary: 'Un espacio propuesto para conversar con Victoria sobre tu rutina, los productos que usás y las dudas que te gustaría aclarar.',
    detail: 'Una asesoría de cuidado cosmético diferenciada del primer contacto. La propuesta busca ayudarte a ordenar las preguntas sobre tu rutina y conversar sobre los próximos pasos.',
    audience: 'Para quienes quieren conversar a distancia sobre su rutina y sus dudas sobre productos cosméticos.',
    includes: ['Conversación remota sobre tu rutina actual.', 'Espacio para aclarar dudas sobre productos y hábitos de cuidado cosmético.'],
    modality: 'Remota, coordinada personalmente.',
    exclusions: [...exclusions, 'No incluye guía escrita, PDF ni seguimiento en esta propuesta.'],
    steps: ['Consultá el alcance de la asesoría.', 'Acordá modalidad, duración, valor y condiciones antes de confirmar.', 'Conversá con Victoria sobre tu rutina y tus dudas.'],
    priceUYU: null, durationMinutes: null,
    image: '8a000.png', imageAlt: 'Imagen evocadora de cuidado facial, no representa una consulta online',
  },
];

export function visibleCareServices(review = false): CareService[] {
  return careServices.filter(service => service.status === 'published' || review);
}
export function filterCareServices(services: readonly CareService[], category: CareFilter): CareService[] {
  return services.filter(service => category === 'todos' || service.category === category);
}
