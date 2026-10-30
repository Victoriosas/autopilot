import { clientEditorial } from './clientEditorial.js';
export const categories = ['Bienestar', 'Belleza', 'Pequeños rituales', 'Secretos y cuidados'] as const;
export type EditorialCategory = typeof categories[number];
export type EditorialSource = { title: string; url: string; checkedAt: string | null };
export type EditorialArticle = {
  slug: string;
  title: string;
  date: string | null;
  category: EditorialCategory;
  image: string;
  imageAlt: string;
  paragraphs: readonly string[];
  sections?: readonly { title: string; paragraphs: readonly string[] }[];
  serviceNames?: readonly string[];
  sources: readonly EditorialSource[];
  relatedSlugs: readonly string[];
  status: 'draft' | 'published';
};
export const editorialVersion = 2;
export const articles: readonly EditorialArticle[] = [
  ...clientEditorial,
  {
    slug: 'una-pausa-tranquila-para-vos',
    title: 'Una pausa tranquila para vos',
    date: null,
    category: 'Bienestar',
    image: '/brand/editorial-pausa.svg',
    imageAlt: 'Composición abstracta en tonos cálidos que invita a una pausa',
    paragraphs: [
      'A veces, un pequeño ritual puede empezar con algo sencillo: elegir un rincón cómodo y dedicarte unos minutos sin una tarea pendiente entre las manos.',
      'Podés dejar el teléfono a un lado, preparar tu bebida preferida o simplemente mirar por la ventana. Elegí lo que te resulte agradable, sin convertir la pausa en otra obligación.',
      'No hay una forma perfecta de hacerlo. La propuesta es encontrar un momento propio y adaptarlo a tu día.',
    ],
    sources: [],
    relatedSlugs: ['ordenar-tu-rutina-cosmetica'],
    status: 'draft',
  },
  {
    slug: 'ordenar-tu-rutina-cosmetica',
    title: 'Ordenar tu rutina cosmética sin complicarte',
    date: null,
    category: 'Belleza',
    image: '/brand/editorial-pausa.svg',
    imageAlt: 'Composición abstracta en tonos cálidos para acompañar un ritual de cuidado',
    paragraphs: [
      'Antes de sumar un producto, podés hacer espacio para reconocer los que ya tenés. Agrupalos por uso y dejá a mano sus etiquetas e instrucciones.',
      'Una bandeja o un estante despejado pueden ayudarte a encontrar cada cosa. Conservá los envases originales para mantener visibles las indicaciones y las fechas que informa la marca.',
      'No hace falta usar todo a la vez. Este orden es una propuesta práctica de organización; la elección y el uso de cada cosmético requieren respetar sus instrucciones y tus necesidades particulares.',
    ],
    sources: [],
    relatedSlugs: ['una-pausa-tranquila-para-vos'],
    status: 'draft',
  },
];

// Routes must use these helpers: drafts never become public through a known slug.
export function getPublishedArticles(items: readonly EditorialArticle[] = articles): EditorialArticle[] {
  return items.filter(article => article.status === 'published' && article.date !== null);
}
export function getPublishedArticle(slug: string, items: readonly EditorialArticle[] = articles): EditorialArticle | undefined {
  return getPublishedArticles(items).find(article => article.slug === slug);
}
