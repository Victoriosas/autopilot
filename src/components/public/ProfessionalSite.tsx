import React from 'react';
import './professional.css';

// Existing contact is preserved until the owner resolves the Victoria/Sofía identity discrepancy.
const whatsapp = 'https://wa.me/59897045305?text=Hola%2C%20quisiera%20consultar%20por%20los%20servicios%20de%20Victoriosas.';
export function ContactLink({children = 'Consultar por WhatsApp'}: {children?: React.ReactNode}) {
  return <a className="beauty-button" href={whatsapp} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true"> ↗</span></a>;
}
export function ProfessionalSite() {
  const known = ['/', '/servicios', '/contacto', '/victoria'].includes(window.location.pathname.replace(/\/$/, '') || '/');
  return <div className="professional-site">
    <a className="beauty-skip" href="#contenido">Saltar al contenido</a>
    <header className="beauty-header"><a href="/" className="beauty-brand">Victoriosas<span>Estética · Cuidado · Bienestar</span></a>
      <nav aria-label="Principal"><a href="/#servicios">Servicios</a><a href="/#nosotras">Conocenos</a><a href="/#contacto">Contacto</a></nav>
    </header>
    <main id="contenido">
      {!known && <section className="beauty-section"><h1>Esta página ya no está disponible.</h1><a href="/">Volver al inicio</a></section>}
      <section className="beauty-hero">
        <div><p className="beauty-eyebrow">Ciudad de la Costa · Carrasco</p><h1>Un momento de calma.<br/><em>Un cuidado para vos.</em></h1>
          <p>Conversemos sobre el cuidado y el bienestar que estás buscando. Cada atención comienza con una consulta personal.</p>
          <ContactLink /><a className="beauty-text-link" href="#servicios">Conocer cómo consultar ↓</a>
          <p className="beauty-small">La atención, la cobertura y el presupuesto se confirman personalmente. Escribir no confirma una reserva.</p></div>
        <div className="beauty-art" role="img" aria-label="Composición abstracta en tonos cálidos que evoca calma y cuidado"><span>Tu tiempo.<br/>Tu pausa.<br/><em>Tu bienestar.</em></span></div>
      </section>
      <section id="servicios" className="beauty-section"><p className="beauty-eyebrow">Atención personalizada</p><h2>Encontrá tu punto de partida.</h2>
        <p>Consultá cuáles son los servicios disponibles y cuál se adapta a lo que buscás. Antes de coordinar, recibirás información sobre la propuesta, su duración, las condiciones y el precio total.</p>
        <p>No hay tarifas ni disponibilidad publicadas por el momento.</p><ContactLink>Consultar servicios y orientación</ContactLink>
      </section>
      <section id="nosotras" className="beauty-section beauty-about"><p className="beauty-eyebrow">La persona detrás de Victoriosas</p><h2>El cuidado empieza escuchándote.</h2><p>Nos importa conocer tus preferencias, responder tus preguntas y acordar cada detalle antes de la atención.</p><p>Podés pedir una presentación personal por WhatsApp antes de coordinar tu visita.</p></section>
      <section className="beauty-section"><p className="beauty-eyebrow">Cómo funciona</p><h2>De la consulta a tu momento.</h2><ol className="beauty-steps"><li><h3>Contanos</h3><p>Compartí tu zona y el tipo de atención que te interesa.</p></li><li><h3>Conversamos</h3><p>Confirmamos la propuesta, cobertura, presupuesto y condiciones.</p></li><li><h3>Coordinamos</h3><p>La reserva requiere confirmación personal.</p></li></ol></section>
      <section className="beauty-section"><h2>Antes de escribirnos.</h2><details><summary>¿Dónde puedo consultar por atención?</summary><p>Consultá por Ciudad de la Costa y Carrasco. Otras zonas y condiciones de traslado se confirman en la conversación.</p></details><details><summary>¿Cómo conozco el precio y los horarios?</summary><p>Pedí el presupuesto total, duración y disponibilidad antes de confirmar. La web no confirma turnos automáticamente.</p></details><details><summary>¿Qué datos necesito enviar?</summary><p>Para empezar alcanza con tu zona y el motivo general de consulta. Evitá enviar datos de salud, fotografías íntimas o tu dirección exacta en el primer mensaje.</p></details></section>
      <section id="contacto" className="beauty-section beauty-contact"><p className="beauty-eyebrow">Hablemos</p><h2>Tu próxima pausa empieza acá.</h2><p>La consulta se realiza directamente por WhatsApp. Esta página no recibe ni guarda formularios.</p><ContactLink /></section>
    </main>
    <footer className="beauty-footer"><a className="beauty-brand" href="/">Victoriosas</a><p>Estética y bienestar · Uruguay</p><p>Sin reservas automáticas. Cada atención se confirma personalmente.</p></footer>
  </div>;
}
