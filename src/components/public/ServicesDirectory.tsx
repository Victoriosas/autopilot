import React from 'react';
import { ContactLink } from './ContactLink';
import { serviceGroups, serviceSlug } from './serviceDirectory';
import { serviceDetails } from './serviceDetails';
import { articles, getPublishedArticles } from '../../storefront/editorial';
import { serviceQuestions, firstConsultationQuestions } from './serviceQuestions';

const review = typeof __EDITORIAL_REVIEW__ !== 'undefined' && __EDITORIAL_REVIEW__;
const readings = review ? articles : getPublishedArticles();

export function ServicesDirectory() {
  return <section className="beauty-wrap beauty-section beauty-services-directory">
    <p className="beauty-eyebrow">Victoriosas · estética profesional</p>
    <h1>Nuestros servicios</h1>
    <p>Explorá las opciones de cuidado facial y corporal. La disponibilidad y la técnica adecuada se confirman personalmente durante la evaluación inicial.</p>
    <nav aria-label="Categorías de servicios" className="beauty-directory-categories">
      {serviceGroups.map(group => <a key={group.id} href={'#' + group.id}>{group.title}</a>)}
    </nav>
    <p><a className="beauty-button beauty-button-outline" href="/consultanos">Consultanos</a></p>
    {review && <section aria-label="Guía de primera consulta en revisión"><h2>Cómo empezar</h2><p className="beauty-small">Contenido en borrador para revisión de Victoria; sin publicar.</p>{firstConsultationQuestions.map(item=><details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}
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
          {readings.some(article=>article.serviceNames?.includes(name)) && <aside aria-label={`Lecturas sobre ${name}`}><h4>Antes de consultar</h4>{review && <p className="beauty-small">Lecturas en borrador para revisión; sin publicar.</p>}<ul>{readings.filter(article=>article.serviceNames?.includes(name)).map(article=><li key={article.slug}><a href={"/de-mi-para-ti/"+article.slug}>{article.title}</a></li>)}</ul></aside>}
          {review && <section aria-label={`Preguntas sobre ${name}`}><h4>Preguntas antes de decidir</h4><p className="beauty-small">Borrador para revisión de Victoria.</p>{serviceQuestions[name]?.map(item=><details key={item.question}><summary>{item.question}</summary><p>{item.answer}</p></details>)}</section>}
          <div className="beauty-contact-options">
            <a className="beauty-text-link" href={'/consultanos#' + serviceSlug(name)}>Hablemos de tu cuidado<span aria-hidden="true"> ↗</span></a>
            <ContactLink service={name} className="beauty-text-link">Consultar por {name.toLowerCase()}</ContactLink>
            <ContactLink service={name} channel="email" className="beauty-text-link">Consultar por email sobre {name.toLowerCase()}</ContactLink>
          </div>
        </li>;
      })}</ol>
    </section>)}
  </section>;
}
