import React from 'react';
import { serviceGroups, serviceSlug } from './serviceDirectory';
import { ServicesDirectory } from './ServicesDirectory';

export function TreatmentsPage() {
  const query = new URLSearchParams(window.location.search);
  const slug = query.get('tratamiento') || window.location.hash.slice(1);
  const selected = serviceGroups.flatMap(group => [...group.services]).find(name => serviceSlug(name) === slug);
  const category = serviceGroups.find(group => group.services.some(name => name === selected))?.id || (query.get('categoria') === 'corporales' ? 'corporales' : 'faciales');
  const group = serviceGroups.find(group => group.id === category)!;
  return <>
    {selected ? <><div className="beauty-wrap beauty-detail-back"><a href={'/nuestros-servicios?categoria=' + category}>Volver a {group.title.toLowerCase()}</a></div><ServicesDirectory selectedName={selected} /></> : <section className="beauty-wrap beauty-section beauty-treatment-index">
      <p className="beauty-eyebrow">Tu cuidado empieza aquí.</p><h1>Tratamientos</h1><p>Explorá las opciones. La técnica y la disponibilidad se confirman durante la evaluación inicial remota.</p>
      <nav className="beauty-category-nav" aria-label="Categorías de tratamientos">{serviceGroups.map(item => <a key={item.id} href={'/nuestros-servicios?categoria=' + item.id} aria-current={category === item.id ? 'page' : undefined}>{item.title}</a>)}</nav>
      <h2>{group.title}</h2><ul className="beauty-treatment-links">{group.services.map(name => <li key={name}><a href={'/nuestros-servicios?tratamiento=' + serviceSlug(name)}>{name}<span aria-hidden="true">↗</span></a></li>)}</ul>
      <a className="beauty-text-link" href="/consultanos">No sé qué elegir: quiero orientación</a>
    </section>}
  </>;
}
