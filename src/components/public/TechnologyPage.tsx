import React from 'react';

const equipment = [
  {
    number: '01',
    name: 'Punta de diamante',
    type: 'Cuidado facial',
    description: 'Equipo de exfoliación mecánica que puede considerarse dentro de una rutina profesional de limpieza, según la evaluación de la piel.',
    mark: '◇',
  },
  {
    number: '02',
    name: 'Radiofrecuencia',
    type: 'Tecnología estética',
    description: 'Recurso utilizado en determinados protocolos estéticos. Su conveniencia y las precauciones necesarias se valoran antes de cada aplicación.',
    mark: '◎',
  },
  {
    number: '03',
    name: 'Electroporación facial',
    type: 'Cuidado personalizado',
    description: 'Tecnología de apoyo para protocolos faciales con productos seleccionados. No todos los productos ni todas las pieles requieren el mismo abordaje.',
    mark: '✧',
  },
  {
    number: '04',
    name: 'Dermapen',
    type: 'Tratamiento específico',
    description: 'Dispositivo de microneedling cuyo posible uso requiere una evaluación individual, valoración de contraindicaciones y condiciones de higiene apropiadas.',
    mark: '⌁',
  },
] as const;

export function TechnologyPage() {
  return <section className="beauty-wrap beauty-section beauty-technology-page">
    <header className="beauty-technology-lead">
      <div>
        <p className="beauty-eyebrow">Tecnología estética · criterio profesional</p>
        <h1>Herramientas modernas.<br /><em>Una mirada humana.</em></h1>
        <p>La tecnología acompaña el cuidado, no reemplaza la escucha. Estos son los equipos disponibles en Victoriosas. La elección de una técnica depende de la evaluación inicial y de lo que corresponda en cada caso.</p>
        <a className="beauty-button" href="/consultanos">Quiero orientación personal <span aria-hidden="true">↗</span></a>
      </div>
      <div className="beauty-technology-orbit" aria-hidden="true"><span>V</span><i /><i /><i /></div>
    </header>
    <div className="beauty-technology-section-head">
      <p className="beauty-eyebrow">Equipamiento disponible</p>
      <h2>Precisión en cada detalle.</h2>
    </div>
    <ol className="beauty-equipment-grid">
      {equipment.map(item => <li key={item.number} className="beauty-equipment-card">
        <div className="beauty-equipment-top"><span>{item.number} / 04</span><span aria-hidden="true" className="beauty-equipment-mark">{item.mark}</span></div>
        <p className="beauty-eyebrow">{item.type}</p>
        <h3>{item.name}</h3>
        <p>{item.description}</p>
      </li>)}
    </ol>
    <aside className="beauty-technology-note">
      <div><p className="beauty-eyebrow">Nuestro compromiso</p><h2>Primero, entender qué necesitás.</h2></div>
      <div><p>La evaluación inicial es remota y orientativa. Las técnicas, su disponibilidad, las precauciones y los pasos siguientes se conversan personalmente. Ningún equipo garantiza resultados ni sustituye una consulta médica cuando corresponde.</p>
        <a className="beauty-text-link" href="/victoria">Conocé a Victoria <span aria-hidden="true">↗</span></a></div>
    </aside>
  </section>;
}
