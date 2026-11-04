import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

test('form imports in Node, stays visible and blocks submission until backend readiness is confirmed', async () => {
  const { ConsultationForm } = await import('../components/public/ConsultationForm');
  const html = renderToStaticMarkup(React.createElement(ConsultationForm));
  assert.match(html, /id="formulario-consulta"/);
  assert.match(html, /id="consultation-name"/);
  assert.match(html, /type="submit" disabled=""/);
  assert.match(html, /Verificando la conexión segura/);
  assert.match(html, /Escribir por nuestro formulario/);
  assert.match(html, /WhatsApp/);
  assert.doesNotMatch(html, /mailto:|correo externo/i);
});
