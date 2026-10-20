import React, { useEffect, useId, useRef } from 'react';

// Native modal dialog provides background inertness, Escape and keyboard containment.
export function ConsultationDialog({ title, onClose, children, className = '' }: {
  title: string; onClose: () => void; children: React.ReactNode; className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const titleId = useId();
  useEffect(() => {
    const dialog = ref.current!;
    const trigger = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow = document.body.style.overflow;
    dialog.showModal();
    document.body.style.overflow = 'hidden';
    heading.current?.focus();
    return () => {
      dialog.close();
      document.body.style.overflow = previousOverflow;
      if (trigger?.isConnected) trigger.focus({ preventScroll: true });
    };
  }, []);
  return <dialog ref={ref} aria-labelledby={titleId} className={'beauty-dialog ' + className}
    onCancel={event => { event.preventDefault(); onClose(); }}>
    <div className="beauty-dialog-heading"><h2 id={titleId} ref={heading} tabIndex={-1}>{title}</h2>
      <button type="button" className="beauty-dialog-close" onClick={onClose} aria-label={'Cerrar ' + title}>Cerrar <span aria-hidden="true">×</span></button></div>
    <div className="beauty-dialog-body">{children}</div>
  </dialog>;
}
