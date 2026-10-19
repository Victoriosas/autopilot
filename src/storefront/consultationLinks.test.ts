import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContactLink } from '../components/public/ContactLink';

function message(markup: string) {
  const href = markup.match(/href="([^"]+)"/)?.[1];
  assert.ok(href);
  const url = new URL(href.replace(/&amp;/g, '&'));
  assert.equal(url.origin + url.pathname, 'https://wa.me/59897045305');
  assert.equal(url.searchParams.size, 1);
  return url.searchParams.get('text')!;
}
test('default consultation keeps the established neutral remote message', () => {
  assert.equal(message(renderToStaticMarkup(React.createElement(ContactLink))), 'Hola, quisiera consultar por una evaluación inicial remota con Victoria.');
});
for (const [interest, label] of [['facial', 'cuidado facial'], ['corporal', 'cuidado corporal'], ['relajacion', 'masajes de relajación'], ['orientacion', 'todavía no sé qué cuidado elegir']] as const) {
  test(`WhatsApp carries ${interest} and source without requesting personal details`, () => {
    const html = renderToStaticMarkup(React.createElement(ContactLink, { interest }));
    const text = message(html);
    assert.ok(text.includes(label));
    assert.ok(text.includes('Desde la web de Victoriosas'));
    assert.ok(text.includes('evaluación inicial remota'));
    assert.doesNotMatch(text, /reservado|confirmad|diagnóstico|cédula|foto|historia clínica/i);
    assert.match(html, /target="_blank"/);
    assert.match(html, /rel="noopener noreferrer"/);
  });
}
