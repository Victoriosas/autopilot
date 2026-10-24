import React, { useEffect, useState } from 'react';
import { Bell } from 'lucide-react';
import { apiFetch } from '../../lib/api';

export function ConsultationBell({ selected, onOpen }: { selected: boolean; onOpen(): void }) {
  const [unread, setUnread] = useState<number | null>(null);
  useEffect(() => {
    let mounted = true, sequence = 0;
    const refresh = async () => {
      const current = ++sequence;
      try {
        const res = await apiFetch('/api/beauty/inquiries/admin/metrics'); if (!res.ok) throw Error();
        const data = await res.json();
        if (mounted && current === sequence) setUnread(Number.isSafeInteger(data.unreadRequests) && data.unreadRequests >= 0 ? data.unreadRequests : null);
      } catch { if (mounted && current === sequence) setUnread(null); }
    };
    const onReadingChanged = () => { void refresh(); };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 60000);
    window.addEventListener('consultation-reading-changed', onReadingChanged);
    return () => { mounted = false; window.clearInterval(interval); window.removeEventListener('consultation-reading-changed', onReadingChanged); };
  }, []);
  return <button type="button" aria-current={selected ? 'page' : undefined}
    className={`flex items-center gap-2 rounded-lg border px-4 py-3 ${selected ? 'border-amber-500 bg-amber-950/40 text-amber-100' : 'border-neutral-700'}`} onClick={onOpen}>
    <Bell size={17} aria-hidden="true" /> Consultas {unread !== null ? <span className="rounded-full bg-amber-700 px-2 py-0.5 text-xs" aria-label={`${unread} consultas sin leer`}>{unread}</span> : <span className="text-xs">Lectura sin confirmar</span>}
  </button>;
}
