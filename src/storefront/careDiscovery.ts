import { serviceGroups, serviceSlug } from '../components/public/serviceDirectory';
import { serviceDetails } from '../components/public/serviceDetails';
import { getPublishedArticles, type EditorialArticle } from './editorial';

export type DiscoveryCategory = 'todos' | 'faciales' | 'corporales' | 'masajes' | 'editorial';
export type DiscoveryItem = { title: string; description: string; category: string; href: string; massage: boolean; homeTip?: string };
const normalize = (text: string) => text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// The caller may explicitly supply preview articles. Public search defaults to published content.
export function discoveryItems(editorial: readonly EditorialArticle[] = getPublishedArticles()): DiscoveryItem[] {
  return [
    ...serviceGroups.flatMap(group => group.services.map(title => ({
      title, description: serviceDetails[title].subtitle, category: group.id,
      href: '/nuestros-servicios#' + serviceSlug(title), massage: title.startsWith('Masaje'),
      homeTip: title.startsWith('Masaje') ? 'Dejá el teléfono a un lado unos minutos y hacete un lugar para una pausa.' : 'Un gesto que disfrutes puede volver tu rutina un momento más amable.',
    }))),
    ...editorial.map(article => ({ title: article.title, description: article.paragraphs[0], category: 'editorial',
      href: '/de-mi-para-ti/' + article.slug, massage: false })),
  ];
}

export function searchCare(items: readonly DiscoveryItem[], query: string, category: DiscoveryCategory): DiscoveryItem[] {
  const words = normalize(query.slice(0, 120)).trim().split(/\s+/).filter(word => word && word !== 'de').map(word => word === 'cutis' ? 'facial' : word);
  return items.filter(item => (category === 'todos' || (category === 'masajes' ? item.massage : item.category === category))
    && words.every(word => normalize(`${item.title} ${item.description} ${item.category}`).includes(word)));
}

export const careAreas = { facial: 'cuidado facial', corporal: 'cuidado corporal', relajacion: 'masajes y relajación', rutina: 'rutina cosmética desde casa', orientacion: 'orientación para empezar' } as const;
export const careGoals = ['Conocer las opciones', 'Ordenar mi rutina', 'Dedicarme una pausa'] as const;
export const careStarts = ['Conversar sobre una evaluación remota', 'Consultar una atención presencial', 'Consultar cómo regalar una experiencia'] as const;
export function careGoalOptions(area: keyof typeof careAreas): readonly string[] {
  const items = discoveryItems();
  if (area === 'facial') return items.filter(item => item.category === 'faciales').map(item => item.title);
  if (area === 'corporal') return items.filter(item => item.category === 'corporales').map(item => item.title);
  if (area === 'relajacion') return items.filter(item => item.massage).map(item => item.title);
  return careGoals;
}
export function careServiceHref(goal: string): string | null {
  return discoveryItems().find(item => item.title === goal)?.href ?? null;
}
export function careMessage(area: keyof typeof careAreas, goal: string, start: string): string {
  return `Hola, me interesa ${careAreas[area]}. Mi prioridad es: ${goal}. Quisiera ${start.toLowerCase()}. La técnica, las tarifas y la disponibilidad quedan por confirmar personalmente. Desde la web de Victoriosas.`;
}

export const giftExperiences = ['Libre elección', 'Cuidado facial', 'Masajes y relajación', 'Cuidado corporal'] as const;
export function giftMessage(recipient: string, dedication: string, experience: string, sender = ''): string {
  const from = sender.trim().slice(0, 60);
  return `Hola, quisiera consultar cómo coordinar una experiencia de regalo de ${experience.toLowerCase()} para ${recipient.trim().slice(0, 60) || 'alguien especial'}. ${from ? `De parte de: ${from}. ` : ''}Dedicatoria propuesta: ${dedication.trim().slice(0, 240) || 'Un momento para vos.'} La propuesta está pendiente de confirmar tarifas, disponibilidad y condiciones; no es un voucher emitido. Desde la web de Victoriosas.`;
}
