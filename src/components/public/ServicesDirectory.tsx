import React from 'react';
import { ContactLink } from './ContactLink';
import { serviceGroups, serviceSlug } from './serviceDirectory';

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
      <ol className="beauty-directory-list">{group.services.map(name => <li key={name} id={serviceSlug(name)}>
        <h3>{name}</h3>
        <p>Consultá por esta opción para conocer su alcance, indicaciones, disponibilidad y condiciones. La evaluación previa determinará si corresponde.</p>
        <ContactLink interest="orientacion" className="beauty-text-link">Consultar por {name.toLowerCase()}</ContactLink>
      </li>)}</ol>
    </section>)}
  </section>;
}
