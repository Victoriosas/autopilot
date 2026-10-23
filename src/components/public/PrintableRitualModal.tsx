import React from 'react';
import { ConsultationDialog } from './ConsultationDialog';

const rituals = [
  ['Una pausa sin pendientes', 'Dejá el teléfono a un lado unos minutos. Respirá y date permiso para no estar disponible para todo.'],
  ['Un gesto que disfrutes', 'Hacé de tu rutina un momento amable: una textura que te guste, una toalla suave, un poco de calma.'],
  ['Una mirada más amable', 'Escuchá cómo te sentís hoy. El cuidado no es una exigencia más, es una forma de acompañarte.'],
];

export function PrintableRitualModal({ onClose }: { onClose: () => void }) {
  return <ConsultationDialog title="Guía de rituales para el hogar" className="beauty-ritual-dialog" onClose={onClose}>
    <article className="beauty-printable-content">
      <header><p className="beauty-eyebrow">Victoriosas · De mí para ti</p><h2>Tres pausas amables para tu día</h2><p>Un espacio para escucharte y acompañar tu propio ritmo.</p></header>
      {rituals.map(([title, text], index) => <section className="beauty-printable-ritual" key={title}><span aria-hidden="true">0{index + 1}</span><div><h3>{title}</h3><p>{text}</p></div></section>)}
      <footer><p>Victoriosas · victoriosas.online</p><p className="beauty-small">Propuesta orientativa de autocuidado. No sustituye una valoración médica cuando corresponde. La atención se coordina personalmente con Victoria.</p></footer>
    </article>
    <p className="beauty-small">Elegí «Guardar como PDF» en el diálogo de impresión de tu navegador.</p>
    <button type="button" className="beauty-button" onClick={() => window.print()}>Imprimir o guardar como PDF</button>
  </ConsultationDialog>;
}
