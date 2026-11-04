import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { readFileSync } from 'node:fs';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsultationForm } from '../components/public/ConsultationForm';

test('formulario de consultas es propio y nunca abre correo externo', () => {
  const html = renderToStaticMarkup(React.createElement(ConsultationForm));
  assert.match(html, /id="formulario-consulta"/);
  assert.match(html, /Nombre y apellido/);
  assert.match(html, /Escribir por nuestro formulario/);
  assert.match(html, /Enviar consulta/);
  assert.match(html, /type="submit" disabled=""/);
  assert.doesNotMatch(html, /mailto:|correo externo/i);
});

test('administración se limita a atención, servicios y agentes sin botones comerciales heredados', () => {
  const hub = readFileSync(new URL('../components/admin/ProfessionalAdminHub.tsx', import.meta.url), 'utf8');
  const app = readFileSync(new URL('../App.tsx', import.meta.url), 'utf8');
  assert.match(app, /<ProfessionalAdminHub/);
  assert.match(hub, /<ConsultationInbox/);
  assert.match(hub, /<BeautyRequestsPanel/);
  assert.match(hub, /<BeautyCatalogPanel/);
  assert.match(hub, /<SixAgentStatusPanel/);
  assert.doesNotMatch(hub, /Pipeline Productos|FulfillmentOrdersTable|SupplierManagement|AutopilotRunnerModal|Ver Tienda Pública/);
  assert.doesNotMatch(app, /<AdminHeader|<AutopilotDashboard|<FulfillmentOrdersTable/);
});
