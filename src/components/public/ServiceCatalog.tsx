import React, { useState } from 'react';
import { careCategories, filterCareServices, visibleCareServices } from '../../storefront/careCatalog';
import type { CareFilter, CareService } from '../../storefront/careCatalog';
import { ContactLink } from './ContactLink';
import { ConsultationDialog } from './ConsultationDialog';

export function ServiceCatalog({ review = false }: { review?: boolean }) {
  const [category, setCategory] = useState<CareFilter>('todos');
  const [selected, setSelected] = useState<CareService | null>(null);
  const visible = visibleCareServices(review);
  const filtered = filterCareServices(visible, category);
  return <>
    {review && <p className="editorial-review" role="note">Borrador para revisión: la asesoría online es una propuesta, no un servicio publicado. Su alcance requiere aprobación antes de ofrecerse.</p>}
    <div className="beauty-service-filters" role="group" aria-label="Categorías de cuidados">
      {careCategories.filter(item => item.id === 'todos' || visible.some(s => s.category === item.id)).map(item =>
        <button key={item.id} type="button" aria-pressed={category === item.id} aria-controls="care-results" onClick={() => setCategory(item.id)}>{item.label}</button>)}
    </div>
    <p className="beauty-small beauty-service-count" role="status">{filtered.length} {filtered.length === 1 ? 'opción para explorar' : 'opciones para explorar'}</p>
    <div id="care-results" className="beauty-care-grid">{filtered.map(care => <article key={care.id} id={'cuidado-' + care.id}>
      <img className={'beauty-care-image beauty-care-image-' + visible.indexOf(care)} src={'/brand/figma-gold/' + care.image} alt={care.imageAlt} width="400" height="348" loading="lazy" />
      <div className="beauty-care-title"><h3>{care.name}</h3><span>{care.status === 'draft' ? 'Borrador' : '0' + (visible.indexOf(care) + 1)}</span></div>
      <p className="beauty-care-invitation">{care.invitation}</p><p className="beauty-care-description">{care.summary}</p>
      <p className="beauty-small">{care.modality}</p>
      <button type="button" className="beauty-service-detail" aria-haspopup="dialog" onClick={() => setSelected(care)}>Ver detalles<span className="beauty-visually-hidden"> de {care.name}</span> <span aria-hidden="true">↗</span></button>
      {care.status === 'published' && <div className="beauty-contact-options"><ContactLink interest={care.interest} className="beauty-text-link">{care.action}</ContactLink><ContactLink channel="email" interest={care.interest} className="beauty-text-link">Por email</ContactLink></div>}
    </article>)}</div>
    {selected && <ConsultationDialog title={selected.name} onClose={() => setSelected(null)}>
      <p className="beauty-eyebrow">{selected.status === 'draft' ? 'Propuesta en revisión' : 'Conocé el cuidado'}</p>
      <p>{selected.modality}</p><h3>Qué es</h3><p>{selected.detail}</p><h3>Para quién</h3><p>{selected.audience}</p>
      <h3>Qué incluye</h3><ul>{selected.includes.map(item => <li key={item}>{item}</li>)}</ul>
      <h3>Cómo funciona</h3><ol>{selected.steps.map(item => <li key={item}>{item}</li>)}</ol>
      <h3>Alcance</h3><ul>{selected.exclusions.map(item => <li key={item}>{item}</li>)}</ul>
      {selected.priceUYU !== null && <p>Valor: {new Intl.NumberFormat('es-UY', { style: 'currency', currency: 'UYU' }).format(selected.priceUYU)}</p>}
      {selected.durationMinutes !== null && <p>Duración: {selected.durationMinutes} minutos</p>}
      <p className="beauty-small">Tarifas, duración y condiciones se informan personalmente antes de confirmar. No hay reservas automáticas.</p>
      {selected.status === 'published' ? <div className="beauty-dialog-contact"><ContactLink interest={selected.interest}>{selected.action}</ContactLink><ContactLink interest={selected.interest} channel="email" className="beauty-text-link">Consultar por email</ContactLink></div> : <p className="editorial-review">Esta propuesta no está disponible para contratar. Pendientes de aprobación: alcance, duración, valor y entregables.</p>}
    </ConsultationDialog>}
  </>;
}
