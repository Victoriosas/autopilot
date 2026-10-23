import React, { useRef, useEffect, useState } from 'react';
import { careAreas, careGoals, careStarts, careMessage, careGoalOptions, careServiceHref } from '../../storefront/careDiscovery';
import { ConsultationDialog } from './ConsultationDialog';
import { ContactLink } from './ContactLink';

export function CareFinderModal({ onClose }: { onClose: () => void }) {
  const [step, setStep] = useState(0);
  const [area, setArea] = useState<keyof typeof careAreas>('orientacion');
  const [goal, setGoal] = useState<string>(careGoals[0]);
  const [start, setStart] = useState<string>(careStarts[0]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => { heading.current?.focus(); }, [step]);
  const questions = ['¿Qué te gustaría explorar?', '¿Cuál es tu prioridad hoy?', '¿Cómo te gustaría empezar?', 'Tu consulta preparada'];
  const message = careMessage(area, goal, start);
  return <ConsultationDialog title="Encontrá tu punto de partida" onClose={onClose}>
    <p>Elegí qué te gustaría conversar. Este orientador prepara tus preferencias; la evaluación personal define qué cuidado corresponde.</p>
    <p role="status">{step < 3 ? `Paso ${step + 1} de 3` : 'Listo para revisar'}</p>
    <h3 ref={heading} tabIndex={-1}>{questions[step]}</h3>
    <div className="beauty-discovery-options">
      {step === 0 && Object.entries(careAreas).map(([value, label]) => <button type="button" key={value} onClick={() => { setArea(value as keyof typeof careAreas); setGoal(careGoalOptions(value as keyof typeof careAreas)[0]); setStep(1); }}>{label}</button>)}
      {step === 1 && careGoalOptions(area).map(value => <button type="button" key={value} onClick={() => { setGoal(value); setStep(2); }}>{value}</button>)}
      {step === 2 && careStarts.map(value => <button type="button" key={value} onClick={() => { setStart(value); setStep(3); }}>{value}</button>)}
    </div>
    {step === 3 && <><section className="beauty-finder-result"><p className="beauty-eyebrow">Tu punto de partida</p><h3>{goal}</h3><p>{message}</p>
      {careServiceHref(goal) && <a className="beauty-text-link" href={careServiceHref(goal)!} onClick={onClose}>Ver detalles de {goal.toLowerCase()}</a>}
      {area === 'rutina' && <p className="beauty-small">Podés conversar sobre tu rutina durante la evaluación inicial. La asesoría online independiente sigue en preparación y no está disponible para contratar.</p>}
      <p className="beauty-small">Una pausa sin pendientes: dejá el teléfono a un lado unos minutos y date permiso para escucharte.</p></section>
      <div className="beauty-discovery-actions"><ContactLink context={message}>Consultar por WhatsApp</ContactLink><ContactLink context={message} channel="email" /></div>
      <a className="beauty-text-link" href={'/consultanos' + (careServiceHref(goal)?.replace('/nuestros-servicios', '') || '')}>Preparar consulta en la web</a></>}
    {step > 0 && <div className="beauty-discovery-actions"><button type="button" onClick={() => setStep(step - 1)}>Volver</button><button type="button" onClick={() => { setArea('orientacion'); setGoal(careGoals[0]); setStart(careStarts[0]); setStep(0); }}>Empezar de nuevo</button></div>}
  </ConsultationDialog>;
}
