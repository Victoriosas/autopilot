import React, { useId, useState } from 'react';
import { articles, getPublishedArticles } from '../../storefront/editorial';
import { discoveryItems, searchCare, type DiscoveryCategory } from '../../storefront/careDiscovery';
import { ConsultationDialog } from './ConsultationDialog';
import { ContactLink } from './ContactLink';

const review = typeof __EDITORIAL_REVIEW__ !== 'undefined' && __EDITORIAL_REVIEW__;
const items = discoveryItems(review ? articles : getPublishedArticles());
const categories: [DiscoveryCategory, string][] = [['todos', 'Todos'], ['faciales', 'Faciales'], ['corporales', 'Corporales'], ['masajes', 'Masajes'], ['editorial', 'Editorial']];
export function QuickSearchDialog({ onClose }: { onClose: () => void }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<DiscoveryCategory>('todos');
  const id = useId();
  const results = searchCare(items, query, category);
  return <ConsultationDialog title="Buscar cuidados" onClose={onClose}>
    <label htmlFor={id}>¿Qué te gustaría explorar?</label>
    <input id={id} className="beauty-discovery-input" type="search" maxLength={120} value={query} onChange={event => setQuery(event.target.value)} placeholder="Faciales, masajes, hidratación…" />
    <div className="beauty-discovery-actions" role="group" aria-label="Filtrar resultados">
      {categories.map(([value, label]) => <button type="button" key={value} aria-pressed={category === value} onClick={() => setCategory(value)}>{label} ({searchCare(items, '', value).length})</button>)}
    </div>
    <p role="status">{results.length} resultados{review ? ' · Incluye borradores para revisión' : ''}</p>
    <ul className="beauty-search-results">{results.map(item => <li key={item.href}>
      <a className="beauty-text-link" href={item.href} onClick={onClose}>{item.title}</a><p>{item.description}</p>
      {item.homeTip && <p className="beauty-small"><strong>Un gesto en casa:</strong> {item.homeTip}</p>}
    </li>)}</ul>
    {!results.length && <><p>Probá con otra palabra o consultá para empezar con orientación personal.</p><ContactLink interest="orientacion" /></>}
  </ConsultationDialog>;
}
