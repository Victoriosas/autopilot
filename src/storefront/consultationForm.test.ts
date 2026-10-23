import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('form imports in Node and stays closed until backend readiness is known', async () => {
  const { ConsultationForm } = await import('../components/public/ConsultationForm');
  const html = renderToStaticMarkup(React.createElement(ConsultationForm));
  assert.doesNotMatch(html, /<form|<input|<textarea/);
  assert.match(html, /WhatsApp/);
  assert.match(html, /victoriosas.online@gmail.com/);
});
