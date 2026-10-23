import React, { useEffect, useRef, useState } from 'react';

export function CopyMessageButton({ text }: { text: string }) {
  const [status, setStatus] = useState('');
  const mounted = useRef(true);
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; }; }, []);
  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(text);
      if (mounted.current) setStatus('Mensaje copiado');
    } catch {
      if (mounted.current) setStatus('No se pudo copiar. Podés seleccionar el texto o abrir el mensaje por email.');
    }
  }
  return <div className="beauty-copy"><button type="button" className="beauty-copy-button" onClick={copy}>Copiar texto sugerido</button><p role="status" className="beauty-small">{status}</p></div>;
}
