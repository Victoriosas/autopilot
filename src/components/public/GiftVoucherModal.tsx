import React, { useId, useState } from 'react';
import { giftExperiences, giftMessage } from '../../storefront/careDiscovery';
import { ConsultationDialog } from './ConsultationDialog';
import { ContactLink } from './ContactLink';

export function GiftVoucherModal({ onClose }: { onClose: () => void }) {
  const [recipient, setRecipient] = useState('');
  const [dedication, setDedication] = useState('');
  const [experience, setExperience] = useState<string>(giftExperiences[0]);
  const id = useId();
  const context = giftMessage(recipient, dedication, experience);
  return <ConsultationDialog title="Pensá una experiencia de regalo" onClose={onClose}>
    <p>Prepará una propuesta para conversar. Tarifas, disponibilidad y condiciones se confirman personalmente antes de contratar.</p>
    <div className="beauty-discovery-fields">
      <label htmlFor={id + '-name'}>Nombre de pila o apodo (opcional)</label>
      <input id={id + '-name'} className="beauty-discovery-input" maxLength={60} value={recipient} onChange={event => setRecipient(event.target.value)} autoComplete="off" />
      <label htmlFor={id + '-experience'}>Experiencia para consultar</label>
      <select id={id + '-experience'} className="beauty-discovery-input" value={experience} onChange={event => setExperience(event.target.value)}>{giftExperiences.map(value => <option key={value}>{value}</option>)}</select>
      <label htmlFor={id + '-message'}>Dedicatoria (opcional)</label>
      <textarea id={id + '-message'} className="beauty-discovery-input" maxLength={240} value={dedication} onChange={event => setDedication(event.target.value)} />
    </div>
    <section className="beauty-gift-preview" aria-label="Vista previa de la propuesta">
      <p className="beauty-eyebrow">Victoriosas · Propuesta de regalo</p><h3>Un momento para {recipient.trim() || 'alguien especial'}</h3>
      <p>{dedication.trim() || 'Un momento para vos.'}</p><p>{experience}</p>
      <p className="beauty-small">Pendiente de confirmación. No es un voucher emitido ni acredita una compra.</p>
    </section>
    <p className="beauty-small">Estos datos se usan en esta vista; al abrir WhatsApp o email se incluyen en el mensaje que podés revisar antes de enviar.</p>
    <div className="beauty-discovery-actions"><ContactLink context={context}>Consultar regalo por WhatsApp</ContactLink><ContactLink context={context} channel="email">Consultar regalo por email</ContactLink></div>
  </ConsultationDialog>;
}
