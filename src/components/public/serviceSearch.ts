export function normalizeServiceSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('es').trim();
}

export function matchesServiceSearch(name: string, subtitle: string, query: string) {
  const searchable = normalizeServiceSearch(name + ' ' + subtitle);
  return normalizeServiceSearch(query).split(/\s+/).filter(Boolean).every(word => searchable.includes(word));
}
