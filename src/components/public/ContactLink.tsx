import React from 'react';
import type { serviceGroups } from './serviceDirectory';
type ServiceName = typeof serviceGroups[number]['services'][number];
const interests = {
  facial: 'me interesa el cuidado facial',
  corporal: 'me interesa el cuidado corporal',
  relajacion: 'me interesan los masajes de relajación',
  orientacion: 'todavía no sé qué cuidado elegir',
  online: 'me interesa la asesoría de cuidado facial online',
};
export type ConsultationInterest = keyof typeof interests;
export const contactEmail = 'victoriosas.online@gmail.com';
export function ContactLink({children, className = 'beauty-button', icon, interest, service, channel = 'whatsapp'}: {children?: React.ReactNode; className?: string; icon?: string; interest?: ConsultationInterest; service?: ServiceName; channel?: 'whatsapp' | 'email'}) {
  const message = service
    ? `Hola, me interesa consultar por ${service}. Quisiera conversar sobre una evaluación inicial remota. Desde la web de Victoriosas.`
    : interest === 'online'
    ? 'Hola, Victoria. Me interesa conocer la asesoría de cuidado facial online. ¿Podés contarme cómo funciona, qué incluye y su valor? Desde la web de Victoriosas.'
    : interest
    ? `Hola, ${interests[interest]}. Quisiera consultar por una evaluación inicial remota. Desde la web de Victoriosas.`
    : 'Hola, quisiera consultar por una evaluación inicial remota con Victoria.';
  const whatsapp = 'https://wa.me/59897045305?text=' + encodeURIComponent(message);
  const href = channel === 'email'
    ? `mailto:${contactEmail}?subject=${encodeURIComponent('Consulta · Victoriosas')}&body=${encodeURIComponent(message)}`
    : whatsapp;
  return <a className={className} href={href} target={channel === 'whatsapp' ? '_blank' : undefined} rel={channel === 'whatsapp' ? 'noopener noreferrer' : undefined}>{children ?? (channel === 'email' ? 'Consultar por email' : 'Consultar por WhatsApp')}{icon ? <img className="beauty-icon" src={icon} alt="" width="17" height="17" /> : <span aria-hidden="true"> ↗</span>}</a>;
}
