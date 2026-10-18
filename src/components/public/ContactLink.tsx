import React from 'react';
// Preserve the established brand contact without attributing the phone to a different person.
const whatsapp = 'https://wa.me/59897045305?text=Hola%2C%20quisiera%20consultar%20por%20una%20evaluaci%C3%B3n%20inicial%20remota%20con%20Victoria.';
export function ContactLink({children = 'Consultar por WhatsApp'}: {children?: React.ReactNode}) {
  return <a className="beauty-button" href={whatsapp} target="_blank" rel="noopener noreferrer">{children}<span aria-hidden="true"> ↗</span></a>;
}
