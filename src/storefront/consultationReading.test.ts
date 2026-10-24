import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsultationReadControl } from '../components/admin/ConsultationReadControl';

test('read controls distinguish unread, read and unknown without implying delivery', () => {
  const render = (readAt: string | null | undefined, busy = false) => renderToStaticMarkup(React.createElement(ConsultationReadControl, { readAt, busy, onChange: () => { throw Error('RENDER_MUST_NOT_WRITE'); } }));
  assert.match(render(null), /Sin leer/);
  assert.match(render(null), /Marcar como leída/);
  assert.match(render('2026-10-24T03:30:00.000Z'), /Marcar como no leída/);
  assert.match(render(undefined), /Lectura sin confirmar/);
  assert.match(render(undefined), /disabled/);
  assert.match(render(null, true), /disabled/);
  assert.doesNotMatch(render(null), /Respondida|Enviada/);
});
