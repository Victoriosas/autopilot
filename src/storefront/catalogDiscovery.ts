import type { Product } from '../types';
import { isCatalogVisible, hasExternalChannel } from './salesChannel';

export type Routine = 'all' | 'skincare' | 'spa' | 'tools' | 'accessories';
export type CatalogSort = 'featured' | 'price_asc' | 'price_desc';
export const ROUTINES: { value: Routine; label: string }[] = [
  { value: 'all', label: 'Toda la selección' },
  { value: 'skincare', label: 'Cuidado diario' },
  { value: 'spa', label: 'Spa en casa' },
  { value: 'tools', label: 'Herramientas faciales' },
  { value: 'accessories', label: 'Accesorios de rutina' },
];
const normalize = (text: string) => text.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
const patterns: Record<Exclude<Routine, 'all'>, RegExp> = {
  skincare: /\b(skincare|skin care|serum|bruma|esencia|limpiador|crema|hidratante|hidratacion|cuidado facial|parches|hidrogel)\b/,
  spa: /\b(spa|vaporizador|vapor facial|masajeador|masaje|mascara|mask)\b/,
  tools: /\b(herramientas?|gua sha|rodillo|roller|masajeador|cepillo facial)\b/,
  accessories: /\b(accesorios?|vincha|diadema|neceser|toalla|headband|organizador)\b/,
};

export function routineMatches(product: Product, routine: Routine): boolean {
  return routine === 'all' || patterns[routine].test(normalize([product.title, product.category, product.subCategory, ...(product.tags || [])].filter(Boolean).join(' ')));
}

export function discoverProducts(products: readonly Product[], options: {
  category: string; query: string; maximumPrice: number; routine: Routine;
  inStockOnly: boolean; sort: CatalogSort;
}): Product[] {
  const words = normalize(options.query).split(/\s+/).filter(Boolean);
  return products.filter(product => {
    if (!isCatalogVisible(product)) return false;
    if (options.category !== 'Todos' && product.category !== options.category) return false;
    if ((!hasExternalChannel(product) && product.price > options.maximumPrice) || !routineMatches(product, options.routine)) return false;
    if (options.inStockOnly && (hasExternalChannel(product) || !Number.isInteger(product.inventory) || product.inventory <= 0)) return false;
    const searchable = normalize([product.title, product.description, product.category, product.sku, ...(product.tags || [])].filter(Boolean).join(' '));
    return words.every(word => searchable.includes(word));
  }).sort((a, b) => hasExternalChannel(a) !== hasExternalChannel(b) && options.sort !== 'featured' ? (hasExternalChannel(a) ? 1 : -1) : options.sort === 'price_asc' ? a.price - b.price : options.sort === 'price_desc' ? b.price - a.price : 0);
}
