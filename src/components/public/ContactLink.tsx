import React from 'react';
const interests = {
  facial: 'me interesa el cuidado facial',
  corporal: 'me interesa el cuidado corporal',
  relajacion: 'me interesan los masajes de relajación',
  orientacion: 'todavía no sé qué cuidado elegir',
};
export type ConsultationInterest = keyof typeof interests;
export const contactEmail = 'victoriosas.online@gmail.com';
export function ContactLink({children, className = 'beauty-button', icon, interest, channel = 'whatsapp'}: {children?: React.ReactNode; className?: string; icon?: string; interest?: ConsultationInterest; channel?: 'whatsapp' | 'email'}) {
  const message = interest
    ? `Hola, ${interests[interest]}. Quisiera consultar por una evaluación inicial remota. Desde la web de Victoriosas.`
    : 'Hola, quisiera consultar por una evaluación inicial remota con Victoria.';
  const whatsapp = 'https://wa.me/59897045305?text=' + encodeURIComponent(message);
  const href = channel === 'email'
    ? `mailto:${contactEmail}?subject=${encodeURIComponent('Consulta · Victoriosas')}&body=${encodeURIComponent(message)}`
    : whatsapp;
  return <a className={className} href={href} target={channel === 'whatsapp' ? '_blank' : undefined} rel={channel === 'whatsapp' ? 'noopener noreferrer' : undefined}>{children ?? (channel === 'email' ? 'Consultar por email' : 'Consultar por WhatsApp')}{icon ? <img className="beauty-icon" src={icon} alt="" width="17" height="17" /> : <span aria-hidden="true"> ↗</span>}</a>;
}
