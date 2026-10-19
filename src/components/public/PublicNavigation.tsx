import React, { useState } from 'react';
import { ConsultationDialog } from './ConsultationDialog';

export function PublicNavigation() {
  const [open, setOpen] = useState(false);
  const primary = [['/#servicios', 'Servicios'], ['/#nosotras', 'Victoria'], ['/#como-empezar', 'Cómo empezar']];
  const secondary = [['/de-mi-para-ti', 'De mí para ti'], ['/#preguntas', 'Preguntas frecuentes'], ['/#contacto', 'Contacto'], ['/privacidad', 'Privacidad']];
  return <>
    <nav className="beauty-desktop-nav" aria-label="Principal">{primary.map(([href, label]) => <a key={href} href={href}>{label}</a>)}</nav>
    <button type="button" className="beauty-menu-trigger" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>Menú <span aria-hidden="true">☰</span></button>
    {open && <ConsultationDialog title="Menú" className="beauty-menu-dialog" onClose={() => setOpen(false)}><nav aria-label="Navegación móvil">{[...primary, ...secondary].map(([href, label]) => <a key={href} href={href} onClick={() => setOpen(false)}>{label}</a>)}</nav></ConsultationDialog>}
  </>;
}
