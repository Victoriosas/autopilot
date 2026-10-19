import React from 'react';
const interests = {
  facial: 'me interesa el cuidado facial',
  corporal: 'me interesa el cuidado corporal',
  relajacion: 'me interesan los masajes de relajación',
  orientacion: 'todavía no sé qué cuidado elegir',
};
export type ConsultationInterest = keyof typeof interests;
export function ContactLink({children = 'Consultar por WhatsApp', className = 'beauty-button', icon, interest}: {children?: React.ReactNode; className?: string; icon?: string; interest?: ConsultationInterest}) {
  const message = interest
    ? `Hola, ${interests[interest]}. Quisiera consultar por una evaluación inicial remota. Desde la web de Victoriosas.`
    : 'Hola, quisiera consultar por una evaluación inicial remota con Victoria.';
  const whatsapp = 'https://wa.me/59897045305?text=' + encodeURIComponent(message);
  return <a className={className} href={whatsapp} target="_blank" rel="noopener noreferrer">{children}{icon ? <img className="beauty-icon" src={icon} alt="" width="17" height="17" /> : <span aria-hidden="true"> ↗</span>}</a>;
}
