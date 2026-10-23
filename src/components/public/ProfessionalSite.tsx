import React from 'react';
import './professional.css';
import { ConsultationForm } from './ConsultationForm';
import { EditorialPage } from './EditorialPage';
import { ContactLink, contactEmail } from './ContactLink';
import { ServiceCatalog } from './ServiceCatalog';
import { PublicNavigation } from './PublicNavigation';
import { ServicesDirectory } from './ServicesDirectory';
import { visibleCareServices } from '../../storefront/careCatalog';
import { PrivacyPage } from './PrivacyPage';

const asset = '/brand/figma-gold/';
const arrow = asset + 'e3eb3.svg';
const whiteArrow = asset + '774e5.svg';
const steps = [
  ['Nos escribes', 'Cuéntame qué te gustaría cuidar y qué dudas tienes. No necesitas tener todo claro para comenzar.', 'Primer contacto por WhatsApp'],
  ['Te escucho y te oriento', 'Coordinamos una evaluación inicial remota para conocer tus necesidades y conversar sobre las opciones.', 'Evaluación a distancia'],
  ['Definimos juntas', 'Te comunico la propuesta, las tarifas y la disponibilidad. Cada atención se acuerda y confirma personalmente.', 'Sin reservas automáticas'],
];
const rituals = [
  ['Una pausa sin pendientes', 'Deja el teléfono a un lado unos minutos. Respira y date permiso para no estar disponible para todo.'],
  ['Un gesto que disfrutes', 'Haz de tu rutina un momento amable: una textura que te guste, una toalla suave, un poco de calma.'],
  ['Una mirada más amable', 'Escucha cómo te sientes hoy. El cuidado no es una exigencia más, es una forma de acompañarte.'],
];
const faqs = [
  ['¿Cómo es la evaluación inicial remota?', 'El primer contacto es por WhatsApp. Victoria coordina contigo una evaluación a distancia para escuchar tus necesidades, orientarte y definir los siguientes pasos de forma personal.'],
  ['¿Y si no sé qué cuidado elegir?', 'No necesitas elegir antes de escribir. Puedes contar qué buscas o cómo te sientes; la orientación inicial ayuda a explorar las opciones contigo.'],
  ['¿Dónde consulto tarifas y disponibilidad?', 'Se informan de forma privada luego de la evaluación, según lo valorado en cada caso.'],
  ['¿Puedo reservar directamente desde la web?', 'Sin reservas automáticas. Cada atención se confirma de forma personal por WhatsApp.'],
  ['¿La evaluación sustituye una consulta médica?', 'La evaluación es orientativa y no sustituye una valoración médica cuando corresponde.'],
];

function Brand() {
  return <a href="/" className="beauty-brand">VICTORIOSAS<span>Estética profesional</span></a>;
}
function Home() {
  return <>
    <section className="beauty-hero beauty-wrap">
      <div className="beauty-welcome"><p className="beauty-eyebrow">Tu bienestar, a tu manera</p><h1>Para sentirte<br />segura y<br /><em>victoriosa.</em></h1>
        <p className="beauty-intro">Estética facial, corporal y masajes. Un espacio de cuidado para escucharte, acompañarte y empezar por lo que necesitas hoy.</p>
        <ContactLink icon={whiteArrow}>Conversemos por WhatsApp</ContactLink><p className="beauty-small">Empezamos con una evaluación inicial remota.</p>
        <a className="beauty-discover" href="#servicios"><img src={asset + 'd7cd8.svg'} alt="" width="15" height="15" />Conocer los cuidados</a>
      </div>
      <figure className="beauty-hero-art"><img className="beauty-hero-image" src={asset + 'eafbd.png'} alt="Imagen evocadora de un momento de cuidado facial" width="600" height="648" fetchPriority="high" />
        <div className="beauty-ritual-detail"><img src={asset + '3fc72.png'} alt="Toalla y detalle de un ritual de cuidado" width="184" height="198" /></div><figcaption>Un momento para ti.</figcaption>
      </figure>
    </section>
    <section className="beauty-philosophy beauty-wrap"><span aria-hidden="true" /><h2>No se trata de cambiar quién eres.<br />Se trata de hacerte un lugar.</h2><p>Sin comparaciones ni exigencias. En Victoriosas, el cuidado empieza por reconocer tu propio ritmo y lo que te hace sentir bien.</p></section>
    <section id="servicios" className="beauty-band"><div className="beauty-wrap beauty-section">
      <div className="beauty-section-heading"><div><p className="beauty-eyebrow">Tu cuidado empieza aquí.</p><h2>Encontrá tu punto de partida.</h2></div><p>Tres formas de volver a ti.<br />Elegí qué te gustaría conversar. No necesitás tenerlo todo claro.</p></div>
      <ServiceCatalog review={__SERVICE_REVIEW__} />
      <div className="beauty-start-help"><div><h3>¿Todavía no sabés qué elegir?</h3><p>Podemos empezar por una conversación, a tu ritmo.</p></div><div className="beauty-contact-options"><ContactLink interest="orientacion" className="beauty-button beauty-button-outline" icon={arrow}>Quiero orientación</ContactLink><ContactLink channel="email" interest="orientacion" className="beauty-text-link" icon={arrow}>Orientación por email</ContactLink></div></div>
      <p className="beauty-small beauty-start-note">Podés consultar por WhatsApp o email. Los enlaces preparan un mensaje para que lo revises y decidas si enviarlo; no confirman una reserva. Tarifas, modalidad, zona y disponibilidad se acuerdan personalmente antes de confirmar.</p>
    </div></section>
    <section id="nosotras" className="beauty-wrap beauty-section beauty-split">
      <figure className="beauty-essence-image"><img src={asset + '98809.png'} alt="Toallas y cuenco en un espacio de calma, imagen evocadora" width="544" height="520" loading="lazy" /><figcaption>Menos prisa. Más presencia.</figcaption></figure>
      <div><p className="beauty-eyebrow">La esencia de Victoriosas</p><h2>Detrás de cada cuidado,<br />una conversación.</h2><p>Soy Victoria, responsable de Victoriosas, en Uruguay. Te acompaño personalmente desde el primer mensaje, para entender qué buscas y orientarte con claridad.</p><p>Cada persona llega con una historia distinta. Por eso, antes de definir los próximos pasos, hay tiempo para escucharte, resolver tus dudas y respetar tus decisiones.</p><ul className="beauty-values"><li>Escucha</li><li>Respeto</li><li>Confidencialidad</li></ul><ContactLink className="beauty-text-link" icon={arrow}>Quiero conversar con Victoria</ContactLink><p className="beauty-signature">Victoria</p></div>
    </section>
    <section id="como-empezar" className="beauty-band"><div className="beauty-wrap beauty-section">
      <div className="beauty-section-heading"><div><p className="beauty-eyebrow">Un primer paso sencillo</p><h2>Todo empieza por escucharte.</h2></div><p>Una conversación personal.<br />Sin apuro y sin compromiso de reservar.</p></div>
      <ol className="beauty-steps">{steps.map(([title, description, detail], i) => <li key={title}><div className="beauty-step-number"><span>0{i + 1}</span><span /></div><h3>{title}</h3><p>{description}</p><p className="beauty-step-detail">{detail}</p></li>)}</ol>
      <p className="beauty-orientation"><img src={asset + '18cc8.svg'} alt="" width="18" height="18" />La evaluación es orientativa y no sustituye una valoración médica cuando corresponde. Tu bienestar guía cada decisión.</p>
    </div></section>
    <section id="de-mi-para-ti" className="beauty-wrap beauty-section beauty-split">
      <figure className="beauty-everyday-image"><img src={asset + 'b7846.png'} alt="Un rincón tranquilo con luz natural y pequeños detalles de cuidado" width="544" height="610" loading="lazy" /><figcaption>Lo pequeño también es cuidado.</figcaption></figure>
      <div><p className="beauty-eyebrow"><a href="/de-mi-para-ti">De mí para ti</a></p><h2>La belleza también está<br />en lo cotidiano.</h2><p>El bienestar no ocurre solo durante una atención. También vive en esos pequeños rituales que te devuelven a ti.</p><div className="beauty-rituals">{rituals.map(([title, text]) => <section key={title}><h3>{title}</h3><p>{text}</p></section>)}</div></div>
    </section>
    <section id="preguntas" className="beauty-band"><div className="beauty-wrap beauty-section beauty-faq"><div><p className="beauty-eyebrow">Con tranquilidad</p><h2>Tus dudas también<br />tienen su espacio.</h2><p>Si hay algo más que quieras saber, puedes preguntarme directamente. Estoy aquí para orientarte.</p><ContactLink className="beauty-text-link" icon={arrow}>Hacer otra consulta</ContactLink></div>
      <div>{faqs.map(([question, answer], i) => <details key={question} open={i < 2}><summary>{question}<img className="beauty-faq-plus" src={asset + 'e4e2b.svg'} alt="" width="18" height="18" /><img className="beauty-faq-minus" src={asset + '78bc1.svg'} alt="" width="18" height="18" /></summary><p>{answer}</p></details>)}</div>
    </div></section>
    <div className="beauty-wrap beauty-section"><a className="beauty-button beauty-button-outline" href="/consultanos">Hablemos de tu cuidado</a></div>
    <section id="contacto" className="beauty-wrap beauty-section beauty-final"><div><p className="beauty-eyebrow">Cuando tú quieras</p><h2>Tu momento puede<br />empezar con <em>un hola.</em></h2><p>Escríbeme y encontramos juntas el primer paso.<br />A tu ritmo, con confianza y sin juicios.</p></div><div className="beauty-contact-card"><p className="beauty-eyebrow"><img src={asset + 'fcd40.svg'} alt="" width="23" height="23" />Directamente con Victoria</p><p className="beauty-small">Si quieres, puedes empezar así:</p><blockquote>“Hola, quisiera consultar por una evaluación inicial remota con Victoria.”</blockquote><ContactLink icon={whiteArrow}>Escribir a Victoria</ContactLink><p className="beauty-small">WhatsApp · +598 97 045 305</p><div className="beauty-email-block"><p className="beauty-eyebrow">¿Preferís escribir por correo?</p><ContactLink channel="email" className="beauty-button beauty-button-outline" icon={arrow}>Consultar por email</ContactLink><p className="beauty-small"><a className="beauty-email-address" href={'mailto:' + contactEmail}>{contactEmail}</a></p><p className="beauty-small">Se abre tu aplicación de correo con un mensaje editable. Si no se abre, copiá la dirección y escribinos desde tu correo habitual.</p></div></div></section>
  </>;
}
export function ProfessionalSite() {
  const path = window.location.pathname.replace(/\/$/, '') || '/';
  const editorial = path === '/de-mi-para-ti' || path.startsWith('/de-mi-para-ti/');
  const privacy = path === '/privacidad';
  const directory = path === '/nuestros-servicios';
  const consultation = path === '/consultanos';
  const known = editorial || privacy || directory || consultation || ['/', '/servicios', '/contacto', '/victoria'].includes(path);
  if (!known) return <div className="professional-site"><main className="beauty-wrap beauty-section"><h1>Esta página ya no está disponible.</h1><p><a href="/">Volver al inicio de Victoriosas</a></p><ContactLink /></main></div>;
  return <div className="professional-site">
    <a className="beauty-skip" href="#contenido">Saltar al contenido</a>
    <header className="beauty-header beauty-wrap"><Brand /><PublicNavigation /><a className="beauty-button beauty-button-outline" href="/consultanos">Consultanos</a></header>
    <main id="contenido" className={editorial || privacy || consultation ? 'beauty-editorial-main beauty-wrap' : undefined}>{consultation ? <><h1>Consultanos</h1><ConsultationForm /></> : privacy ? <PrivacyPage /> : editorial ? <EditorialPage /> : directory ? <ServicesDirectory /> : <Home />}</main>
    <footer className="beauty-footer"><div className="beauty-wrap"><div className="beauty-footer-grid"><div><Brand /><p className="beauty-footer-promise">Para sentirte segura y victoriosa.</p></div><div><h2>Cuidados</h2>{visibleCareServices().map(care => <a key={care.id} href="/#servicios">{care.name}</a>)}</div><div><h2>Victoriosas</h2><a href="/#nosotras">Atención personal</a><a href="/#como-empezar">Cómo empezar</a><a href="/de-mi-para-ti">De mí para ti</a><a href="/#preguntas">Preguntas frecuentes</a></div><div><h2>Conversemos</h2><a href="https://wa.me/59897045305" target="_blank" rel="noopener noreferrer">+598 97 045 305 ↗</a><a className="beauty-email-address" href={'mailto:' + contactEmail}>{contactEmail}</a><p>Uruguay</p><p>Atención coordinada<br />personalmente con Victoria.</p></div></div><div className="beauty-footer-bottom"><p>© Victoriosas · Estética profesional</p><p>Cuidado personal. Respeto por tu historia. Confidencialidad.</p><a href="/privacidad">Contacto y privacidad</a><a href="#contenido">Volver arriba ↑</a></div></div></footer>
  </div>;
}
