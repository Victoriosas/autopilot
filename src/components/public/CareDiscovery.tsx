import React, { useState } from 'react';
import './discovery.css';
import { QuickSearchDialog } from './QuickSearchDialog';
import { CareFinderModal } from './CareFinderModal';
import { GiftVoucherModal } from './GiftVoucherModal';

export function CareDiscovery() {
  const [active, setActive] = useState<'search' | 'finder' | 'gift' | null>(null);
  return <div className="beauty-discovery beauty-wrap" role="group" aria-label="Explorar cuidados">
    <div className="beauty-discovery-actions">
      <button type="button" aria-haspopup="dialog" onClick={() => setActive('search')}>Buscar cuidados</button>
      <button type="button" aria-haspopup="dialog" onClick={() => setActive('finder')}>Encontrá tu punto de partida</button>
      <button type="button" aria-haspopup="dialog" onClick={() => setActive('gift')}>Pensá un regalo</button>
    </div>
    {active === 'search' && <QuickSearchDialog onClose={() => setActive(null)} />}
    {active === 'finder' && <CareFinderModal onClose={() => setActive(null)} />}
    {active === 'gift' && <GiftVoucherModal onClose={() => setActive(null)} />}
  </div>;
}
