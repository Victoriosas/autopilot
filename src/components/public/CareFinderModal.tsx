import React, { useRef, useEffect, useState } from 'react';
import { careAreas, careGoals, careStarts, careMessage } from '../../storefront/careDiscovery';
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
    <p>Elegí tus preferencias para preparar una conversación. La evaluación personal define qué cuidado corresponde.</p>
    <p role="status">{step < 3 ? `Paso ${step + 1} de 3` : 'Listo para revisar'}</p>
    <h3 ref={heading} tabIndex={-1}>{questions[step]}</h3>
    <div className="beauty-discovery-options">
      {step === 0 && Object.entries(careAreas).map(([value, label]) => <button type="button" key={value} onClick={() => { setArea(value as keyof typeof careAreas); setStep(1); }}>{label}</button>)}
      {step === 1 && careGoals.map(value => <button type="button" key={value} onClick={() => { setGoal(value); setStep(2); }}>{value}</button>)}
      {step === 2 && careStarts.map(value => <button type="button" key={value} onClick={() => { setStart(value); setStep(3); }}>{value}</button>)}
    </div>
    {step === 3 && <><p>{message}</p><div className="beauty-discovery-actions"><ContactLink interest={area} context={message}>Consultar por WhatsApp</ContactLink><ContactLink interest={area} context={message} channel="email" /></div></>}
    {step > 0 && <div className="beauty-discovery-actions"><button type="button" onClick={() => setStep(step - 1)}>Volver</button><button type="button" onClick={() => { setArea('orientacion'); setGoal(careGoals[0]); setStart(careStarts[0]); setStep(0); }}>Empezar de nuevo</button></div>}
  </ConsultationDialog>;
}
