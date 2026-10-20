import React from 'react';
import { ContactLink } from './ContactLink';
import { serviceGroups, serviceSlug } from './serviceDirectory';
import { serviceDetails } from './serviceDetails';

export function ServicesDirectory() {
  return <section className="beauty-wrap beauty-section beauty-services-directory">
    <p className="beauty-eyebrow">Victoriosas · estética profesional</p>
    <h1>Nuestros servicios</h1>
    <p>Explorá las opciones de cuidado facial y corporal. La disponibilidad y la técnica adecuada se confirman personalmente durante la evaluación inicial.</p>
    <nav aria-label="Categorías de servicios" className="beauty-directory-categories">
      {serviceGroups.map(group => <a key={group.id} href={'#' + group.id}>{group.title}</a>)}
    </nav>
    {serviceGroups.map(group => <section id={group.id} key={group.id}>
      <h2>{group.title}</h2>
      <ol className="beauty-directory-list">{group.services.map(name => {
        const info = serviceDetails[name];
        return <li key={name} id={serviceSlug(name)}>
          <h3>{name}</h3>
          <p className="beauty-service-subtitle">{info.subtitle}</p>
          <details className="beauty-service-expand">
            <summary>Ver detalles del tratamiento</summary>
            <div className="beauty-service-expand-body">
              <p>{info.description}</p>
              <h4>Objetivos y características</h4>
              <ul>{info.objectives.map(objective => <li key={objective}>{objective}</li>)}</ul>
              <p><strong>Duración y frecuencia:</strong> {info.duration}.</p>
              <p className="beauty-service-caution"><strong>Importante:</strong> {info.caution}</p>
            </div>
          </details>
          <ContactLink interest="orientacion" className="beauty-text-link">Consultar por {name.toLowerCase()}</ContactLink>
        </li>;
      })}</ol>
    </section>)}
  </section>;
}
