import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsultationForm } from '../components/public/ConsultationForm';
import { ProfessionalAdminHub } from '../components/admin/ProfessionalAdminHub';

test('formulario de consultas permanece visible antes del chequeo de disponibilidad', () => {
  const html = renderToStaticMarkup(React.createElement(ConsultationForm));
  assert.match(html, /id="formulario-consulta"/);
  assert.match(html, /Nombre y apellido/);
  assert.match(html, /Enviar consulta/);
  assert.match(html, /Verificando la conexi/);
  assert.match(html, /href="\/consultanos\?canal=email#formulario-consulta"/);
  assert.doesNotMatch(html, /mailto:|correo externo/i);
});

test('administración muestra atención real sin controles de comercio heredado', () => {
  const html = renderToStaticMarkup(React.createElement(ProfessionalAdminHub, { onOpenAccount: () => {}, sessionKey: 'test' }));
  assert.match(html, /Centro de atención/);
  assert.match(html, /Consultas/);
  assert.match(html, /Solicitudes/);
  assert.match(html, /Servicios/);
  assert.match(html, /Agentes/);
  assert.doesNotMatch(html, /Pipeline Productos|Fulfillment|Proveedores|Restablecer catálogo|Ver Tienda Pública/);
});
