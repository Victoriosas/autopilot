import React from 'react';
import { ContactLink } from './ContactLink';

// Capture stays closed until a separate consent, verified provider and unsubscribe flow exist.
// Never store an email locally or report a subscription without server confirmation.
export function NewsletterSubscribe() {
  return <section className="beauty-newsletter" aria-labelledby="newsletter-title">
    <div><p className="beauty-eyebrow">De mí para ti</p><h2 id="newsletter-title">Lecturas a tu ritmo.</h2>
      <p>Estamos preparando un boletín con pequeños rituales y novedades de Victoriosas.</p>
      <p className="beauty-small">Las suscripciones todavía no están abiertas. Podés consultar por email; este enlace prepara un mensaje editable y no te suscribe a ninguna lista.</p></div>
    <ContactLink channel="email" context="Hola, quisiera saber cuándo estará disponible el boletín de Victoriosas. Entiendo que esta consulta no me suscribe a una lista." className="beauty-button beauty-button-outline">Consultar por novedades</ContactLink>
  </section>;
}
