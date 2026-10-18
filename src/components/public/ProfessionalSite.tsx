import React from 'react';
import './professional.css';
import { EditorialPage, EditorialTeaser } from './EditorialPage';

import { ContactLink } from './ContactLink';
export function ProfessionalSite() {
  const editorial = window.location.pathname === '/de-mi-para-ti' || window.location.pathname.startsWith('/de-mi-para-ti/');
  const known = editorial || ['/', '/servicios', '/contacto', '/victoria'].includes(window.location.pathname.replace(/\/$/, '') || '/');
  if (!known) return <div className="professional-site"><main className="beauty-section"><h1>Esta página ya no está disponible.</h1><p><a href="/">Volver al inicio de Victoriosas</a></p><ContactLink /></main></div>;
  return <div className="professional-site">
    <a className="beauty-skip" href="#contenido">Saltar al contenido</a>
    <header className="beauty-header"><a href="/" className="beauty-brand">Victoriosas<span>Estética profesional</span></a>
      <nav aria-label="Principal"><a href="/#servicios">Servicios</a><a href="/#nosotras">Conocenos</a><a href="/de-mi-para-ti">De mí para ti</a><a href="/#contacto">Contacto</a></nav>
    </header>
    <main id="contenido">
      {editorial ? <EditorialPage /> : <>
      <section className="beauty-hero">
        <div><p className="beauty-eyebrow">Victoriosas · Estética profesional</p><h1>Para sentirte segura<br/><em>y victoriosa.</em></h1>
          <p>Toda atención comienza con una evaluación inicial remota con Victoria. Conversamos sobre lo que buscás y orientamos los siguientes pasos antes de considerar un tratamiento.</p>
          <ContactLink>Solicitar evaluación remota</ContactLink><a className="beauty-text-link" href="#servicios">Conocer cómo consultar ↓</a>
          <p className="beauty-small">La evaluación es orientativa y no sustituye la valoración médica cuando corresponde. Escribir no confirma una cita.</p></div>
        <picture className="beauty-portrait"><source media="(max-width:700px)" srcSet="/brand/sofia-victoria-hero-mobile.jpg" /><img src="/brand/sofia-victoria-hero.jpg" alt="Victoria, de Victoriosas" width="1672" height="941" fetchPriority="high" /></picture>
      </section>
      <section id="servicios" className="beauty-section"><p className="beauty-eyebrow">Atención personalizada</p><h2>Encontrá tu punto de partida.</h2>
        <p>Primero solicitá una evaluación inicial remota. Victoria te orienta y determina si corresponde ofrecer un tratamiento; los detalles y los siguientes pasos se acuerdan personalmente.</p>
        <p>No hay tarifas ni disponibilidad publicadas por el momento.</p><ContactLink>Solicitar orientación inicial</ContactLink>
      </section>
      <section id="nosotras" className="beauty-section beauty-about"><p className="beauty-eyebrow">La persona detrás de Victoriosas</p><h2>Conocé a Victoria.</h2><p>El cuidado empieza escuchándote. Para conocer su enfoque de atención y conversar sobre lo que buscás, escribinos.</p><p>Podés pedir una presentación personal por WhatsApp antes de decidir los siguientes pasos.</p></section>
      <section className="beauty-section"><p className="beauty-eyebrow">Cómo funciona</p><h2>De la consulta a tu momento.</h2><ol className="beauty-steps"><li><h3>Contanos</h3><p>Escribí por WhatsApp para solicitar una evaluación inicial remota.</p></li><li><h3>Evaluamos a distancia</h3><p>Victoria conversa con vos para orientar la consulta de forma individual.</p></li><li><h3>Definimos los pasos</h3><p>Se determina si corresponde un tratamiento. Toda coordinación requiere confirmación personal.</p></li></ol></section>
      <section className="beauty-section"><h2>Antes de escribirnos.</h2><details><summary>¿Cómo comienza la atención?</summary><p>Toda atención comienza con una evaluación inicial remota por coordinación personal con Victoria. No se confirma una cita automáticamente.</p></details><details><summary>¿Cómo conozco el precio y los horarios?</summary><p>Pedí el presupuesto total, duración y disponibilidad antes de confirmar. La web no confirma turnos automáticamente.</p></details><details><summary>¿Qué datos necesito enviar?</summary><p>Para empezar alcanza con el motivo general de consulta. No compartas información clínica en comentarios públicos. Evitá enviar datos de salud, fotografías íntimas o tu dirección exacta en el primer mensaje.</p></details></section>
      <EditorialTeaser />
      <section id="contacto" className="beauty-section beauty-contact"><p className="beauty-eyebrow">Hablemos</p><h2>Tu próxima pausa empieza acá.</h2><p>Solicitá tu evaluación inicial remota por WhatsApp. Esta página no recibe ni guarda formularios ni evaluaciones privadas.</p><ContactLink /></section>
      </>}
    </main>
    <footer className="beauty-footer"><a className="beauty-brand" href="/">Victoriosas</a><p>Estética profesional · Uruguay</p><p>Sin reservas automáticas. Cada atención se confirma personalmente.</p></footer>
  </div>;
}
