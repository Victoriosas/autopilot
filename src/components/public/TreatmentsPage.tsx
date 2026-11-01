import React from 'react';
import { serviceGroups, serviceSlug } from './serviceDirectory';
import { serviceDetails } from './serviceDetails';
import { matchesServiceSearch } from './serviceSearch';
import { ServicesDirectory } from './ServicesDirectory';

const media: Record<string, string> = {
  faciales: '/brand/figma-gold/8a000.png',
  corporales: '/brand/figma-gold/dde65.png',
};

export function TreatmentsPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get('tratamiento') || window.location.hash.slice(1);
  const selected = serviceGroups.flatMap(group => [...group.services]).find(name => serviceSlug(name) === slug);
  const category = serviceGroups.find(group => group.services.some(name => name === selected))?.id
    || (params.get('categoria') === 'corporales' ? 'corporales' : 'faciales');
  const group = serviceGroups.find(item => item.id === category)!;
  const [filter, setFilter] = React.useState('');
  const services = group.services.filter(name => matchesServiceSearch(name, serviceDetails[name].subtitle, filter));
  const openFinder = () => window.dispatchEvent(new Event('open-care-finder'));

  if (selected) return <>
    <div className="beauty-wrap beauty-detail-back"><a href={'/nuestros-servicios?categoria=' + category}>← Volver a {group.title.toLowerCase()}</a></div>
    <ServicesDirectory selectedName={selected} />
  </>;

  return <section className="beauty-wrap beauty-section beauty-treatment-index beauty-treatment-experience">
    <div className="beauty-treatment-intro">
      <div>
        <p className="beauty-eyebrow">Tu cuidado empieza aquí.</p>
        <h1>Tratamientos<span className="beauty-title-accent"> para vos.</span></h1>
        <p>Explorá nuestras opciones faciales y corporales. Cada técnica se considera individualmente y la atención comienza con una evaluación remota.</p>
        <div className="beauty-treatment-intro-actions">
          <button type="button" className="beauty-button" onClick={openFinder}>Ayudame a elegir <span aria-hidden="true">↗</span></button>
          <a className="beauty-button beauty-button-outline" href="/tecnologia">Conocé nuestra tecnología</a>
        </div>
      </div>
      <aside className="beauty-treatment-intro-aside">
        <span className="beauty-orbit-symbol" aria-hidden="true">✧</span>
        <p className="beauty-eyebrow">Nuestro método</p>
        <strong>Tu cuidado, paso a paso.</strong>
        <p>Escucha, orientación y elección personalizada. Sin reservas ni tarifas públicas.</p>
      </aside>
    </div>

    <nav className="beauty-category-nav" aria-label="Categorías de tratamientos">
      {serviceGroups.map(item => <a key={item.id} href={'/nuestros-servicios?categoria=' + item.id} aria-current={category === item.id ? 'page' : undefined}>
        {item.title}<span aria-hidden="true">↗</span>
      </a>)}
    </nav>

    <div className="beauty-treatment-category-heading">
      <img src={media[category]} alt={category === 'faciales' ? 'Fotografía ilustrativa de cuidado facial' : 'Fotografía ilustrativa de cuidado corporal'} loading="lazy" width="380" height="240" />
      <div>
        <p className="beauty-eyebrow">{category === 'faciales' ? 'Rostro · cuidado individual' : 'Cuerpo · bienestar personal'}</p>
        <h2>{group.title}</h2>
        <p>{category === 'faciales' ? 'Rituales y técnicas para explorar según las necesidades de tu piel.' : 'Cuidados corporales y masajes que se conversan según tus necesidades.'}</p>
      </div>
    </div>

    <div className="beauty-treatment-search" role="search" aria-label="Filtrar tratamientos">
      <label htmlFor="treatment-query">Encontrá tu tratamiento</label>
      <div className="beauty-treatment-search-field">
        <span aria-hidden="true">⌕</span>
        <input id="treatment-query" type="search" placeholder="Buscá por nombre o necesidad" autoComplete="off" maxLength={120} value={filter} onChange={event => setFilter(event.target.value)} aria-describedby="treatment-count" />
        {filter && <button type="button" onClick={() => setFilter('')}>Limpiar</button>}
      </div>
      <p id="treatment-count" role="status" aria-live="polite">{services.length} {services.length === 1 ? 'tratamiento disponible para explorar' : 'tratamientos para explorar'}</p>
    </div>

    <ul className="beauty-treatment-links beauty-treatment-card-grid">
      {services.map((name, i) => <li key={name}>
        <a href={'/nuestros-servicios?tratamiento=' + serviceSlug(name)}>
          <span className="beauty-treatment-card-num">{String(i + 1).padStart(2, '0')}</span>
          <span className="beauty-treatment-card-copy"><strong>{name}</strong><small>{serviceDetails[name].subtitle}</small></span>
          <span className="beauty-treatment-card-arrow" aria-hidden="true">↗</span>
        </a>
      </li>)}
    </ul>
    {services.length === 0 && <p className="beauty-search-empty">No encontramos coincidencias en esta categoría. Probá otra palabra o pedinos orientación.</p>}
    <div className="beauty-treatment-bottom">
      <p>¿Todavía tenés dudas? No necesitás elegir un tratamiento antes de escribirnos.</p>
      <a className="beauty-text-link" href="/consultanos">Conversemos sobre tu cuidado <span aria-hidden="true">↗</span></a>
    </div>
  </section>;
}
