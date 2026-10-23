import React, { useState, useEffect } from 'react';
import { ConsultationDialog } from './ConsultationDialog';
import { serviceGroups, serviceSlug } from './serviceDirectory';
import { QuickSearchDialog } from './QuickSearchDialog';
import { CareFinderModal } from './CareFinderModal';

export function PublicNavigation() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [finderOpen, setFinderOpen] = useState(false);

  useEffect(() => {
    const handleOpenSearch = () => setSearchOpen(true);
    const handleOpenFinder = () => setFinderOpen(true);
    window.addEventListener('open-quick-search', handleOpenSearch);
    window.addEventListener('open-care-finder', handleOpenFinder);
    return () => {
      window.removeEventListener('open-quick-search', handleOpenSearch);
      window.removeEventListener('open-care-finder', handleOpenFinder);
    };
  }, []);

  const primary = [
    ['/#servicios', 'Servicios'],
    ['/#nosotras', 'Victoria'],
    ['/#como-empezar', 'Cómo empezar'],
    ['/de-mi-para-ti', 'De mí para ti'],
    ['/consultanos', 'Consultanos'],
  ];
  const secondary = [
    ['/#preguntas', 'Preguntas frecuentes'],
    ['/#contacto', 'Contacto'],
    ['/privacidad', 'Privacidad'],
  ];

  const directory = (
    <div className="beauty-services-submenu">
      <a href="/nuestros-servicios" onClick={() => setMenuOpen(false)}>Ver todos los servicios</a>
      {serviceGroups.map((group) => (
        <details key={group.id}>
          <summary>{group.title}</summary>
          <ol>
            {group.services.map((name) => (
              <li key={name}>
                <a href={'/nuestros-servicios#' + serviceSlug(name)} onClick={() => setMenuOpen(false)}>{name}</a>
              </li>
            ))}
          </ol>
        </details>
      ))}
    </div>
  );

  return (
    <>
      <nav className="beauty-desktop-nav" aria-label="Principal">
        {primary.map(([href, label]) => (
          <a key={href} href={href}>
            {label}
          </a>
        ))}
        <details className="beauty-nav-dropdown">
          <summary>Nuestros servicios</summary>
          {directory}
        </details>
        <button
          type="button"
          onClick={() => setSearchOpen(true)}
          className="beauty-nav-quick-btn"
          title="Buscar servicios y lecturas"
          aria-label="Abrir buscador"
        >
          <span aria-hidden="true">🔍</span> Buscar
        </button>
        <button
          type="button"
          onClick={() => setFinderOpen(true)}
          className="beauty-nav-quick-btn beauty-nav-finder-btn"
          title="Orientador interactivo de cuidado"
          aria-label="Abrir orientador de cuidado"
        >
          <span aria-hidden="true">✨</span> Orientador
        </button>
      </nav>

      <button
        type="button"
        className="beauty-menu-trigger"
        aria-haspopup="dialog"
        aria-expanded={menuOpen}
        onClick={() => setMenuOpen(true)}
      >
        Menú <span aria-hidden="true">☰</span>
      </button>

      {menuOpen && (
        <ConsultationDialog
          title="Menú"
          className="beauty-menu-dialog"
          onClose={() => setMenuOpen(false)}
        >
          <nav aria-label="Navegación móvil">
            <div className="beauty-mobile-quick-actions">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setSearchOpen(true);
                }}
                className="beauty-button beauty-button-outline"
                style={{ width: '100%', marginBottom: '8px' }}
              >
                🔍 Buscar en catálogo
              </button>
              <button
                type="button"
                onClick={() => {
                  setMenuOpen(false);
                  setFinderOpen(true);
                }}
                className="beauty-button"
                style={{ width: '100%', marginBottom: '14px' }}
              >
                ✨ Orientador de cuidado
              </button>
            </div>
            {primary.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
            <details>
              <summary>Nuestros servicios</summary>
              {directory}
            </details>
            {secondary.map(([href, label]) => (
              <a key={href} href={href} onClick={() => setMenuOpen(false)}>
                {label}
              </a>
            ))}
          </nav>
        </ConsultationDialog>
      )}

      {searchOpen && <QuickSearchDialog onClose={() => setSearchOpen(false)} />}
      {finderOpen && <CareFinderModal onClose={() => setFinderOpen(false)} />}
    </>
  );
}
