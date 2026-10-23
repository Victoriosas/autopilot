import { serviceGroups, serviceSlug } from '../components/public/serviceDirectory';
import { serviceDetails } from '../components/public/serviceDetails';
import { getPublishedArticles, type EditorialArticle } from './editorial';

export type DiscoveryCategory = 'todos' | 'faciales' | 'corporales' | 'masajes' | 'editorial';
export type DiscoveryItem = { title: string; description: string; category: string; href: string; massage: boolean };
const normalize = (text: string) => text.toLocaleLowerCase('es').normalize('NFD').replace(/[\u0300-\u036f]/g, '');

// The caller may explicitly supply preview articles. Public search defaults to published content.
export function discoveryItems(editorial: readonly EditorialArticle[] = getPublishedArticles()): DiscoveryItem[] {
  return [
    ...serviceGroups.flatMap(group => group.services.map(title => ({
      title, description: serviceDetails[title].subtitle, category: group.id,
      href: '/nuestros-servicios#' + serviceSlug(title), massage: title.startsWith('Masaje'),
    }))),
    ...editorial.map(article => ({ title: article.title, description: article.paragraphs[0], category: 'editorial',
      href: '/de-mi-para-ti/' + article.slug, massage: false })),
  ];
}

export function searchCare(items: readonly DiscoveryItem[], query: string, category: DiscoveryCategory): DiscoveryItem[] {
  const words = normalize(query.slice(0, 120)).trim().split(/\s+/).filter(Boolean);
  return items.filter(item => (category === 'todos' || (category === 'masajes' ? item.massage : item.category === category))
    && words.every(word => normalize(`${item.title} ${item.description} ${item.category}`).includes(word)));
}

export const careAreas = { facial: 'cuidado facial', corporal: 'cuidado corporal', relajacion: 'masajes y relajación', orientacion: 'orientación para empezar' } as const;
export const careGoals = ['Conocer las opciones', 'Ordenar mi rutina', 'Dedicarme una pausa'] as const;
export const careStarts = ['Conversar sobre una evaluación remota', 'Consultar cómo regalar una experiencia'] as const;
export function careMessage(area: keyof typeof careAreas, goal: string, start: string): string {
  return `Hola, me interesa ${careAreas[area]}. Mi prioridad es: ${goal}. Quisiera ${start.toLowerCase()}. La técnica, las tarifas y la disponibilidad quedan por confirmar personalmente. Desde la web de Victoriosas.`;
}

export const giftExperiences = ['Libre elección', 'Cuidado facial', 'Masajes y relajación'] as const;
export function giftMessage(recipient: string, dedication: string, experience: string): string {
  return `Hola, quisiera consultar cómo coordinar una experiencia de regalo de ${experience.toLowerCase()} para ${recipient.trim().slice(0, 60) || 'alguien especial'}. Dedicatoria propuesta: ${dedication.trim().slice(0, 240) || 'Un momento para vos.'} La propuesta está pendiente de confirmar tarifas, disponibilidad y condiciones; no es un voucher emitido. Desde la web de Victoriosas.`;
}
