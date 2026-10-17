export const STORE_CATEGORIES = ['Todos', 'Rostro', 'Cuerpo', 'Kits'] as const;

export function readCatalogLocation(search: string) {
  const params = new URLSearchParams(search);
  const category = params.get('category') || 'Todos';
  return {
    query: params.get('q') || '',
    category: STORE_CATEGORIES.some(value => value === category) ? category : 'Todos',
  };
}

export function writeCatalogLocation(href: string, state: { query: string; category: string }) {
  const url = new URL(href);
  if (state.query.trim()) url.searchParams.set('q', state.query);
  else url.searchParams.delete('q');
  if (state.category !== 'Todos') url.searchParams.set('category', state.category);
  else url.searchParams.delete('category');
  return url.href;
}
