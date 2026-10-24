import React from 'react';

export function ConsultationReadControl({ readAt, busy, onChange }: {
  readAt: string | null | undefined; busy: boolean; onChange(read: boolean): void;
}) {
  return <div className="my-3 flex flex-wrap items-center gap-3">
    <span className="text-sm">{readAt === undefined ? 'Lectura sin confirmar' : readAt ? 'Leída' : 'Sin leer'}</span>
    <button type="button" className="min-h-11 rounded border border-neutral-500 px-3 py-2" disabled={busy || readAt === undefined}
      onClick={() => onChange(!readAt)}>{readAt ? 'Marcar como no leída' : 'Marcar como leída'}</button>
  </div>;
}
