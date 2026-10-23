import React, { useState } from 'react';
import { ConsultationDialog } from './ConsultationDialog';
import { serviceGroups, serviceSlug } from './serviceDirectory';

export function PublicNavigation() {
  const [open, setOpen] = useState(false);
  const primary = [['/#servicios', 'Servicios'], ['/#nosotras', 'Victoria'], ['/#como-empezar', 'Cómo empezar'], ['/de-mi-para-ti', 'De mí para ti']];
  const secondary = [['/#preguntas', 'Preguntas frecuentes'], ['/#consultanos', 'Consultanos'], ['/#contacto', 'Contacto'], ['/privacidad', 'Privacidad']];
  const directory = <div className="beauty-services-submenu">
    <a href="/nuestros-servicios">Ver todos los servicios</a>
    {serviceGroups.map(group => <details key={group.id}>
      <summary>{group.title}</summary>
      <ol>{group.services.map(name => <li key={name}>
        <a href={'/nuestros-servicios#' + serviceSlug(name)}>{name}</a>
      </li>)}</ol>
    </details>)}
  </div>;
  return <>
    <nav className="beauty-desktop-nav" aria-label="Principal">
      {primary.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
      <details className="beauty-nav-dropdown"><summary>Nuestros servicios</summary>{directory}</details>
    </nav>
    <button type="button" className="beauty-menu-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Menú <span aria-hidden="true">☰</span></button>
    {open && <ConsultationDialog title="Menú" className="beauty-menu-dialog" onClose={() => setOpen(false)}>
      <nav aria-label="Navegación móvil">{primary.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}
      <details><summary>Nuestros servicios</summary>{directory}</details>
      {secondary.map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}</nav>
    </ConsultationDialog>}
  </>;
}
