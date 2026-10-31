import React from 'react';
import { serviceGroups, serviceSlug } from './serviceDirectory';

export function ServiceShortcuts() {
  return <section className="beauty-wrap beauty-section beauty-service-shortcuts" aria-labelledby="treatments-title">
    <div className="beauty-section-heading"><div><p className="beauty-eyebrow">Nuestros servicios</p><h2 id="treatments-title">De la curiosidad a una conversación.</h2></div><p>Explorá cada tratamiento, sus características y las precauciones antes de consultar.</p></div>
    <div className="beauty-shortcut-groups">{serviceGroups.map(group => <section key={group.id} aria-labelledby={'shortcut-' + group.id}>
      <h3 id={'shortcut-' + group.id}>{group.title}</h3>
      <ul>{group.services.slice(0, 3).map(name => <li key={name}><a href={'/nuestros-servicios#' + serviceSlug(name)}>{name}<span aria-hidden="true"> ↗</span></a></li>)}</ul>
      <a className="beauty-text-link" href={'/nuestros-servicios#' + group.id}>Ver todos los {group.title.toLowerCase()}</a>
    </section>)}</div>
    <p className="beauty-small">No necesitás elegir una técnica para escribirnos. La evaluación inicial es remota y la propuesta se acuerda personalmente con Victoria.</p>
    <a className="beauty-button beauty-button-outline" href="/nuestros-servicios">Explorar todos los servicios</a>
  </section>;
}
