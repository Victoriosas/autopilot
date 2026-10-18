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
          <p>A veces la consulta estética no es solo por lo que se ve, sino por cómo te hace sentir. En Victoriosas la atención inicia con una conversación remota. Es un primer espacio de escucha, sin apuro y sin juicio, para comprender qué querés.</p>
          <ContactLink>Solicitar evaluación remota</ContactLink><a className="beauty-text-link" href="#servicios">Conocer cómo consultar ↓</a>
          <p className="beauty-small">La evaluación es profesional, orientativa y no sustituye la valoración médica cuando corresponde.</p></div>
        <picture className="beauty-portrait"><source media="(max-width:700px)" srcSet="/brand/sofia-victoria-hero-mobile.jpg" /><img src="/brand/sofia-victoria-hero.jpg" alt="Victoria, de Victoriosas" width="1672" height="941" fetchPriority="high" /></picture>
      </section>
      <section id="servicios" className="beauty-section"><p className="beauty-eyebrow">Cómo funciona el proceso</p><h2>Pensado para brindarte seguridad, los pasos son claros y por etapas:</h2>
        <ol className="beauty-steps">
          <li><h3>Primer contacto.</h3><p>Se realiza por WhatsApp, contando el motivo de la consulta.</p></li>
          <li><h3>Evaluación a distancia.</h3><p>Es una instancia de escucha y orientación personalizada. Permite comprender la situación y valorar qué acompañamiento es adecuado.</p></li>
          <li><h3>Definición de los pasos.</h3><p>Luego de la evaluación, se define si corresponde proponer un tratamiento. Toda coordinación posterior se acuerda y se confirma de forma personal.</p></li>
        </ol>
        <p>Por respeto a cada proceso, no se publican tarifas ni disponibilidad de forma general. Cada caso requiere una valoración previa.</p>
      </section>
      <section id="nosotras" className="beauty-section beauty-about"><h2>Sobre este espacio</h2><p>Victoriosas es un espacio de cuidado profesional.</p><p>El enfoque es integral. Se entiende que el bienestar y la imagen personal están ligados a la seguridad y a la autoestima.</p><p>Por eso se prioriza un trato respetuoso, confidencial y sin exigencias. Las decisiones sobre el cuerpo se toman desde el cuidado, no desde la culpa o la urgencia.</p><p>La atención está a cargo de Victoria, responsable de Victoriosas.</p></section>
      <section className="beauty-section"><h2>Información antes de consultar</h2>
        <details><summary>¿Cómo inicia la atención?</summary><p>Siempre con la evaluación inicial remota. Es el encuadre necesario para cualquier orientación posterior.</p></details>
        <details><summary>¿Cómo se conocen precios y horarios?</summary><p>Se informan de forma privada luego de la evaluación, según lo valorado en cada caso.</p></details>
        <details><summary>¿Qué información se necesita para empezar?</summary><p>Nombre y motivo general de consulta. No es necesario enviar más información en esta instancia.</p></details>
      </section>
      <EditorialTeaser />
      <section id="contacto" className="beauty-section beauty-contact"><h2>Contacto</h2><p>Si considerás que es un buen momento para consultar, podés solicitar tu evaluación inicial remota.</p><p>Esta página no recibe ni guarda formularios. La comunicación es directa y confidencial por WhatsApp.</p><ContactLink>Consultar por WhatsApp</ContactLink></section>
      </>}
    </main>
    <footer className="beauty-footer"><a className="beauty-brand" href="/">Victoriosas</a><p>Estética profesional · Uruguay</p><p>Sin reservas automáticas. Cada atención se confirma de forma personal.</p></footer>
  </div>;
}
