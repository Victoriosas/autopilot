import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const faq = [
  {
    question: '¿Ya se puede comprar?',
    answer: 'Victoriosa está en apertura progresiva. Los productos solo se mostrarán como comprables cuando estén validados precio, stock, envío y condiciones del canal de pago. Si una opción de pago no está habilitada, la tienda no debe cobrarte.',
  },
  {
    question: '¿Envían a todo Uruguay?',
    answer: 'La cobertura y el plazo dependen del producto y del proveedor. Antes de habilitar una compra mostramos y validamos la evidencia de envío disponible para Uruguay; no asumimos que un envío desconocido sea gratuito o inmediato.',
  },
  {
    question: '¿Cómo eligen los productos?',
    answer: 'El motor de selección analiza proveedor, stock, logística, estructura de costos, encaje con Victoriosa y evidencia de mercado. Los bloqueos de seguridad o cumplimiento tienen prioridad sobre un buen margen.',
  },
  {
    question: '¿Qué pasa con cosméticos o productos regulados?',
    answer: 'Reciben una revisión adicional antes de ser elegibles para publicación. Un producto no pasa automáticamente a venta solo porque tenga stock o rentabilidad.',
  },
  {
    question: '¿Puedo seguir el lanzamiento?',
    answer: 'Sí. Podés crear una cuenta desde la tienda y volver a tu perfil mientras habilitamos nuevas selecciones y canales de compra.',
  },
];

test('FAQ structured data exactly mirrors the visible storefront answers', () => {
  const html = readFileSync('index.html', 'utf8');
  const storefront = readFileSync('src/components/store/StoreExperienceSections.tsx', 'utf8');
  const scripts = [...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)]
    .map(([, json]) => JSON.parse(json));

  const schema = scripts.find((entry) => entry['@type'] === 'FAQPage');
  assert.ok(schema, 'The visible FAQ must have a FAQPage JSON-LD block');

  const expected = faq.map(({ question, answer }) => ({
    '@type': 'Question',
    name: question,
    acceptedAnswer: { '@type': 'Answer', text: answer },
  }));

  assert.deepEqual(schema.mainEntity, expected);
  for (const { question, answer } of faq) {
    assert.ok(storefront.includes(question), `Missing visible FAQ question: ${question}`);
    assert.ok(storefront.includes(answer), `Missing visible FAQ answer for: ${question}`);
  }
});
