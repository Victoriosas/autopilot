import React from 'react';
import { publicPageLocation } from '../../storefront/publicPageLocation';
import './professional.css';
import './discovery.css';
import './noir.css';
import './depth.css';
import './experience.css';
import { ConsultationForm } from './ConsultationForm';
import { EditorialPage } from './EditorialPage';
import { ContactLink, contactEmail } from './ContactLink';
import { PublicNavigation } from './PublicNavigation';
import { TreatmentsPage } from './TreatmentsPage';
import { TechnologyPage } from './TechnologyPage';
import { GiftVoucherModal } from './GiftVoucherModal';
import { PrivacyPage } from './PrivacyPage';

const asset = '/brand/figma-gold/';
const arrow = asset + 'e3eb3.svg';
const whiteArrow = asset + '774e5.svg';
const steps = [
  ['Nos escribes', 'Cuéntame qué te gustaría cuidar y qué dudas tienes. No necesitas tener todo claro para comenzar.', 'Primer contacto por WhatsApp'],
  ['Te escucho y te oriento', 'Coordinamos una evaluación inicial remota para conocer tus necesidades y conversar sobre las opciones.', 'Evaluación a distancia'],
  ['Definimos juntas', 'Te comunico la propuesta, las tarifas y la disponibilidad. Cada atención se acuerda y confirma personalmente.', 'Sin reservas automáticas'],
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
export function Home() {
  return <>
    <section className="beauty-hero beauty-wrap">
      <div className="beauty-welcome"><span className="beauty-tech-kicker">Precisión estética · cuidado personal</span><p className="beauty-eyebrow">Tu bienestar, a tu manera</p><h1>Para sentirte<br />segura y<br /><em>victoriosa.</em></h1>
        <p className="beauty-intro">Estética facial, corporal y masajes. Un espacio de cuidado para escucharte, acompañarte y empezar por lo que necesitas hoy.</p>
        <div className="beauty-home-actions"><a className="beauty-button" href="https://wa.me/59897045305" target="_blank" rel="noopener noreferrer">Conversemos</a><a className="beauty-button beauty-button-outline" href="/nuestros-servicios">Explorar tratamientos</a></div><p className="beauty-small">Empezamos con una evaluación inicial remota. <a className="beauty-home-technology-link" href="/tecnologia">Conocé nuestra tecnología ↗</a></p>
      </div>
      <figure className="beauty-hero-art"><img className="beauty-hero-image" src={asset + 'eafbd.png'} alt="Imagen evocadora de un momento de cuidado facial" width="600" height="648" fetchPriority="high" />
        <figcaption>Un momento para ti.</figcaption>
      </figure>
      <aside className="beauty-tech-panel" aria-label="Nuestro proceso de atención">
        <p className="beauty-tech-panel-label">Nuestra forma de acompañarte</p>
        <p className="beauty-tech-panel-title">Tecnología y cercanía.</p>
        <ol><li><span>01</span> Primer contacto personal</li><li><span>02</span> Evaluación inicial remota</li><li><span>03</span> Tratamiento acordado contigo</li></ol>
      </aside>
    </section>
  </>;
}
export function Victoria() {
  return <section className="beauty-wrap beauty-section beauty-page-copy">
      <p className="beauty-eyebrow">La esencia de Victoriosas</p><h1>Detrás de cada cuidado,<br />una conversación.</h1><p>Soy Victoria, responsable de Victoriosas, en Uruguay. Te acompaño personalmente desde el primer mensaje, para entender qué buscas y orientarte con claridad.</p><p>Cada persona llega con una historia distinta. Por eso, antes de definir los próximos pasos, hay tiempo para escucharte, resolver tus dudas y respetar tus decisiones.</p><div className="beauty-victoria-process"><span className="beauty-eyebrow">Nuestro recorrido</span><ol><li>Primer contacto y escucha</li><li>Evaluación inicial remota</li><li>Orientación y coordinación personal</li></ol><a className="beauty-text-link" href="/tecnologia">Conocé el equipamiento disponible ↗</a></div><ul className="beauty-values"><li>Escucha</li><li>Respeto</li><li>Confidencialidad</li></ul><ContactLink className="beauty-text-link" icon={arrow}>Quiero conversar con Victoria</ContactLink><p className="beauty-signature">Victoria</p>
    </section>;
}
export function ComoEmpezar() {
  return <>
    <section className="beauty-band"><div className="beauty-wrap beauty-section">
      <div className="beauty-section-heading"><div><p className="beauty-eyebrow">Un primer paso sencillo</p><h1>Todo empieza por escucharte.</h1></div><p>Una conversación personal.<br />Sin apuro y sin compromiso de reservar.</p></div>
      <ol className="beauty-steps">{steps.map(([title, description, detail], i) => <li key={title}><div className="beauty-step-number"><span>0{i + 1}</span><span /></div><h2>{title}</h2><p>{description}</p><p className="beauty-step-detail">{detail}</p></li>)}</ol>
      <p className="beauty-orientation"><img src={asset + '18cc8.svg'} alt="" width="18" height="18" />La evaluación es orientativa y no sustituye una valoración médica cuando corresponde. Tu bienestar guía cada decisión.</p>
      <a className="beauty-button" href="/consultanos">Conversemos</a>
    </div></section>
    <section className="beauty-wrap beauty-section beauty-faq"><div><h2>Tus dudas también tienen su espacio.</h2></div><div>{faqs.map(([question, answer]) => <details key={question}><summary>{question}</summary><p>{answer}</p></details>)}</div></section>
  </>;
}
export function Contacto() {
  const [giftOpen, setGiftOpen] = React.useState(false);
  return <><h1 className="beauty-consultation-heading">Consultanos</h1><p>Empezamos con una evaluación inicial remota. Cada atención se confirma de forma personal, sin reservas automáticas.</p><p><a href="/contacto">Cómo empezar y preguntas frecuentes</a></p><ConsultationForm /><p><button type="button" className="beauty-button beauty-button-outline" onClick={() => setGiftOpen(true)}>Diseñar una propuesta de regalo</button></p>{giftOpen && <GiftVoucherModal onClose={() => setGiftOpen(false)} />}</>;
}
export function ProfessionalSite() {
  const [location, setLocation] = React.useState(() => publicPageLocation(window.location.pathname, window.location.search, window.location.hash));
  const path = location.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  React.useEffect(() => {
    const normalized = publicPageLocation(window.location.pathname, window.location.search, window.location.hash);
    if (normalized !== window.location.pathname + window.location.search + window.location.hash) window.history.replaceState(null, '', normalized);
    const restore = () => setLocation(window.location.pathname + window.location.search + window.location.hash);
    window.addEventListener('popstate', restore);
    return () => window.removeEventListener('popstate', restore);
  }, []);
  React.useEffect(() => {
    if (path.startsWith('/de-mi-para-ti')) { document.getElementById('contenido')?.focus({preventScroll:true}); return; }
    if (path === '/victoria') document.title = 'Victoria · Victoriosas';
    else if (path === '/tecnologia') document.title = 'Tecnología estética · Victoriosas';
    else document.title = (path === '/' ? 'Victoriosas · Estética profesional' : path === '/nuestros-servicios' || path === '/servicios' ? 'Tratamientos · Victoriosas' : path === '/consultanos' ? 'Consultanos · Victoriosas' : path === '/contacto' ? 'Cómo empezar · Victoriosas' : path === '/privacidad' ? 'Contacto y privacidad · Victoriosas' : 'De mí para ti · Victoriosas');
    const canonical = document.querySelector('link[rel=canonical]');
    canonical?.setAttribute('href', 'https://victoriosas.online' + path);
    document.getElementById('contenido')?.focus({preventScroll:true});
  }, [location, path]);
  const navigate = (event: React.MouseEvent<HTMLDivElement>) => {
    const link = (event.target as Element).closest('a');
    if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target || link.hasAttribute('download')) return;
    const url = new URL(link.href);
    if (url.origin !== window.location.origin || ['/admin', '/beauty-professional'].some(route => url.pathname.startsWith(route)) || url.hash === '#contenido') return;
    event.preventDefault();
    const next = publicPageLocation(url.pathname, url.search, url.hash);
    window.history.pushState(null, '', next);
    setLocation(next);
    window.scrollTo({top:0,behavior:'instant'});
  };
  const editorial = path === '/de-mi-para-ti' || path.startsWith('/de-mi-para-ti/');
  const directory = path === '/nuestros-servicios' || path === '/servicios';
  const contact = path === '/consultanos';
  const known = editorial || directory || contact || ['/', '/victoria', '/tecnologia', '/contacto', '/privacidad'].includes(path);
  return <div onClick={navigate} className={'professional-site beauty-noir beauty-page-shell' + (path === '/' ? ' beauty-home' : '')}>
    <a className="beauty-skip" href="#contenido">Saltar al contenido</a>
    <header className="beauty-header beauty-wrap"><Brand /><PublicNavigation /><ContactLink>Conversemos</ContactLink></header>
    <main id="contenido" tabIndex={-1} key={location} className={editorial || contact ? 'beauty-editorial-main beauty-wrap' : undefined}>
      {!known ? <section className="beauty-wrap beauty-section"><h1>No encontramos esta página.</h1><a href="/">Volver al inicio</a></section> : path === '/privacidad' ? <PrivacyPage /> : path === '/tecnologia' ? <TechnologyPage /> : path === '/victoria' ? <Victoria /> : path === '/contacto' ? <ComoEmpezar /> : contact ? <Contacto /> : editorial ? <EditorialPage /> : directory ? <TreatmentsPage /> : <Home />}
    </main>
    <footer className="beauty-compact-footer beauty-wrap"><span>Victoria · Atención personal · Uruguay</span><a href="/contacto">Cómo empezar</a><a href="/privacidad">Contacto y privacidad</a><a href={'mailto:' + contactEmail}>{contactEmail}</a></footer>
  </div>;
}
