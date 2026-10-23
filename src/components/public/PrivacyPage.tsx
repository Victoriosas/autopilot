import React from 'react';
import { ContactLink, contactEmail } from './ContactLink';

export function PrivacyPage() {
  React.useEffect(() => {
    document.title = 'Contacto y privacidad · Victoriosas';
    const title = document.title;
    const description = 'Cómo contactar con Victoriosas por email o WhatsApp y qué tener en cuenta antes de compartir información personal.';
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', 'https://victoriosas.online/privacidad');
    for (const name of ['description', 'twitter:description']) document.querySelector(`meta[name="${name}"]`)?.setAttribute('content', description);
    document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
    for (const [name, value] of [['og:title', title], ['og:description', description], ['og:url', 'https://victoriosas.online/privacidad']]) document.querySelector(`meta[property="${name}"]`)?.setAttribute('content', value);
  }, []);
  return <article className="beauty-privacy">
    <a className="beauty-text-link" href="/">← Volver al inicio</a>
    <p className="beauty-eyebrow">Antes de escribir</p><h1>Contacto y privacidad</h1>
    <p>La web de Victoriosas presenta el espacio de cuidado y sus formas de consulta. La atención comienza con una evaluación inicial remota, coordinada personalmente con Victoria.</p>
    <section><h2>Un contacto directo</h2><p>Podés consultar por WhatsApp al <a href="https://wa.me/59897045305" target="_blank" rel="noopener noreferrer">+598 97 045 305</a> o por correo a <a href={'mailto:' + contactEmail}>{contactEmail}</a>.</p><p>Los enlaces de WhatsApp abren un servicio de un tercero. Los enlaces de email intentan abrir tu aplicación de correo con un mensaje preparado. En ambos casos podés revisarlo antes de enviarlo; esta web no lo envía automáticamente. Si no tenés una aplicación de correo configurada, copiá la dirección y usala desde tu correo habitual.</p><p>Podés preguntar cómo se gestionan los mensajes y la información que compartís durante la atención.</p></section>
    <section><h2>Solo lo necesario para empezar</h2><p>Para el primer contacto alcanza con tu nombre y el motivo general de la consulta. No es necesario enviar documentos, fotografías íntimas, estudios ni una historia clínica para iniciar la conversación.</p><p>La evaluación es orientativa y no sustituye una valoración médica cuando corresponde.</p></section>
    <section><h2>Qué hace esta página</h2><p>Esta web pública no ofrece formularios de reserva, cobros ni confirmaciones automáticas. Las tarifas, la disponibilidad y cualquier atención posterior se acuerdan de forma personal.</p><p>Los recursos visuales y las tipografías se sirven desde la propia web. El alojamiento puede procesar datos técnicos necesarios para entregar las páginas; tus mensajes se tramitan mediante WhatsApp, Gmail y el proveedor de correo que utilices, según el canal elegido y la conversación posterior.</p></section>
    <section><h2>Consultas desde la web</h2><p>Cuando el formulario de Consultanos esté habilitado, Victoriosas utilizará tu nombre, celular, servicio de interés, consulta y canal preferido para responderte. El correo y la edad son opcionales; el correo se requiere si elegís recibir la respuesta por ese medio. No pedimos datos de salud ni fotografías y el consentimiento no te suscribe a campañas.</p><p>Las consultas se guardarán en una base de datos de Supabase, con acceso restringido a administración y un plazo de conservación de 30 días. El aviso transaccional mediante Resend a Gmail contendrá solo una referencia, sin los datos de contacto ni el texto de tu consulta. Para limitar el abuso se usará una huella protegida de la dirección de conexión durante un máximo de 24 horas.</p><p>Podés consultar sobre acceso, corrección o eliminación de tu información escribiendo a <a href={'mailto:' + contactEmail}>{contactEmail}</a>. El formulario permanecerá cerrado hasta que estén preparados el envío, el acceso autorizado y el borrado periódico. La conservación de conversaciones posteriores en WhatsApp o correo se informa por esos canales.</p></section>
    <section><h2>Si tenés alguna duda</h2><p>Antes de compartir información personal, podés preguntar qué se necesita y para qué. También podés escribir para consultar sobre la información que ya hayas compartido.</p><div className="beauty-contact-options"><ContactLink>Consultar por WhatsApp</ContactLink><ContactLink channel="email" /></div></section>
  </article>;
}
