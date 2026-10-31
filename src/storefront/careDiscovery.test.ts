import test from 'node:test';
import assert from 'node:assert/strict';
import { articles } from './editorial';
import { careAreas, careGoals, careStarts, careMessage, careGoalOptions, careServiceHref, discoveryItems, giftMessage, searchCare } from './careDiscovery';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ContactLink } from '../components/public/ContactLink';

test('public discovery includes all 19 services, unique destinations and no drafts', () => {
  const items = discoveryItems();
  assert.equal(items.length, 19);
  assert.equal(new Set(items.map(item => item.href)).size, 19);
  assert.ok(items.every(item => item.href.startsWith('/nuestros-servicios#')));
  // Explicit editorial input may include previews; public defaults must exclude them.
  assert.equal(discoveryItems(articles).length, 19 + articles.length);
  assert.equal(items.filter(item => item.category === 'editorial').length, 0);
});
test('discovery combines accent-insensitive words and categories without dead results', () => {
  const items = discoveryItems();
  assert.equal(searchCare(items, '  HIDRATACION labios  ', 'faciales')[0]?.title, 'Hidratación de labios');
  assert.equal(searchCare(items, '', 'faciales').length, 11);
  assert.equal(searchCare(items, '', 'corporales').length, 6);
  assert.equal(searchCare(items, '', 'masajes').length, 4);
  assert.equal(searchCare(items, 'labios', 'corporales').length, 0);
  assert.equal(searchCare(items, 'inexistente', 'todos').length, 0);
  assert.equal(searchCare(items, '', 'editorial').length, 0);
});
test('all guided paths preserve preferences and leave professional decisions pending', () => {
  for (const area of Object.keys(careAreas) as (keyof typeof careAreas)[]) for (const goal of careGoals) for (const start of careStarts) {
    const message = careMessage(area, goal, start);
    assert.ok(message.includes(careAreas[area]));
    assert.ok(message.includes(goal));
    assert.ok(message.includes(start.toLowerCase()));
    assert.match(message, /por confirmar personalmente/);
    assert.doesNotMatch(message, /diagnóstico|ideal|garantiz|reservado/);
  }
});
test('gift proposals bound user text, preserve accents and cannot represent an issued voucher', () => {
  assert.match(giftMessage('', '', 'Libre elección'), /alguien especial/);
  const message = giftMessage(' Sofía & Ana ', 'Pausa + cariño? #1', 'Cuidado facial');
  assert.ok(message.includes('Sofía & Ana'));
  assert.ok(message.includes('Pausa + cariño? #1'));
  assert.match(message, /no es un voucher emitido/);
  assert.ok(giftMessage('a'.repeat(100), 'b'.repeat(300), 'Libre elección').length < 700);
});
test('both contact channels encode the complete proposal as text without adding URL parameters', () => {
  const context = giftMessage('Sofía & Ana', 'Pausa? #1 + cariño &bcc=extra', 'Libre elección');
  for (const channel of ['whatsapp', 'email'] as const) {
    const html = renderToStaticMarkup(React.createElement(ContactLink, { context, channel }));
    const href = html.match(/href="([^"]+)"/)![1].replaceAll('&amp;', '&');
    const url = new URL(href);
    assert.ok(url.searchParams.get(channel === 'email' ? 'body' : 'text')?.endsWith(context));
    assert.deepEqual([...url.searchParams.keys()].sort(), channel === 'email' ? ['body', 'subject'] : ['text']);
  }
});

test('finder preserves the selected treatment and modality without publishing draft services', () => {
  assert.ok(careGoalOptions('facial').includes('Limpieza profunda'));
  assert.equal(careGoalOptions('relajacion').length, 4);
  const message = careMessage('facial', 'Limpieza profunda', 'Consultar una atención presencial');
  assert.match(message, /Limpieza profunda/);
  assert.match(message, /consultar una atención presencial/);
  assert.equal(careServiceHref('Limpieza profunda'), '/nuestros-servicios#limpieza-profunda');
  assert.equal(careServiceHref('Asesoría de cuidado facial online'), null);
  assert.ok(careGoalOptions('rutina').every(goal => !goal.includes('Asesoría')));
});

test('gift proposals preserve the optional sender and bound every user field', () => {
  assert.match(giftMessage('Ana', 'Una pausa', 'Cuidado corporal', 'Sofía'), /De parte de: Sofía/);
  assert.doesNotMatch(giftMessage('Ana', '', 'Libre elección'), /De parte de:/);
  assert.ok(giftMessage('a'.repeat(100), 'b'.repeat(300), 'Libre elección', 'c'.repeat(100)).length < 800);
});
