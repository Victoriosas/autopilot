import React from 'react';
import { ContactLink } from './ContactLink';

export function PrivacyPage() {
  React.useEffect(() => {
    document.title = 'Contacto y privacidad · Victoriosas';
    const title = document.title;
    const description = 'Cómo contactar con Victoriosas por WhatsApp y qué tener en cuenta antes de compartir información personal.';
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://victoriosas.online/privacidad');
    for (const name of ['description', 'twitter:description']) document.querySelector(`meta[name="${name}"]`)?.setAttribute('content', description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    for (const [name, value] of [['og:title', title], ['og:description', description], ['og:url', 'https://victoriosas.online/privacidad']]) document.querySelector(`meta[property="${name}"]`)?.setAttribute('content', value);
  }, []);
  return <article className="beauty-privacy">
    <a className="beauty-text-link" href="/">← Volver al inicio</a>
    <p className="beauty-eyebrow">Antes de escribir</p><h1>Contacto y privacidad</h1>
    <p>La web de Victoriosas presenta el espacio de cuidado y sus formas de consulta. La atención comienza con una evaluación inicial remota, coordinada personalmente con Victoria.</p>
    <section><h2>Un contacto directo</h2><p>Al pulsar un enlace de WhatsApp, salís de esta web y abrís un servicio de un tercero. El mensaje sugerido no se envía automáticamente: podés revisarlo y decidir si querés enviarlo.</p><p>El canal de contacto es <a href="https://wa.me/59897045305" target="_blank" rel="noopener noreferrer">+598 97 045 305</a>. Podés consultar allí cómo se gestionan los mensajes y la información que compartís durante la atención.</p></section>
    <section><h2>Solo lo necesario para empezar</h2><p>Para el primer contacto alcanza con tu nombre y el motivo general de la consulta. No es necesario enviar documentos, fotografías íntimas, estudios ni una historia clínica para iniciar la conversación.</p><p>La evaluación es orientativa y no sustituye una valoración médica cuando corresponde.</p></section>
    <section><h2>Qué hace esta página</h2><p>Esta web pública no ofrece formularios de reserva, cobros ni confirmaciones automáticas. Las tarifas, la disponibilidad y cualquier atención posterior se acuerdan de forma personal.</p><p>Los recursos visuales y las tipografías se sirven desde la propia web. El alojamiento puede procesar datos técnicos necesarios para entregar las páginas; el tratamiento de tus mensajes en WhatsApp corresponde al servicio que elegís abrir y a la conversación posterior.</p></section>
    <section><h2>Si tenés alguna duda</h2><p>Antes de compartir información personal, podés preguntar qué se necesita y para qué. También podés escribir para consultar sobre la información que ya hayas compartido.</p><ContactLink>Consultar con Victoria</ContactLink></section>
  </article>;
}
