import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { ConsultationReadControl } from '../components/admin/ConsultationReadControl';
import { createConsultationReadStore } from './consultationReading';
import type { beautyServerDatabase } from './beautyDatabase';

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

test('reading persistence refuses database errors and invalid counters instead of manufacturing state', async () => {
  const id = '88888888-8888-4888-8888-888888888888';
  const stamp = '2026-10-24T03:30:00.000Z';
  let fail = false, value: unknown = 2, calls = 0;
  const reply = (data: unknown) => ({ error: fail ? { code: 'PRIVATE_DETAIL' } : null, data });
  const database = () => {
    calls++;
    return { from: (table: string) => ({
      select: () => ({ in: async () => reply([{ request_id: id, read_at: stamp }]), single: async () => reply({ unread_requests: value }) }),
      delete: () => ({ eq: async () => reply(null) }),
      upsert: (row: Record<string, unknown>) => {
        assert.equal(table, 'consultation_read_states'); assert.equal(row.request_id, id); assert.equal(row.read_by, 'synthetic-admin');
        return { select: () => ({ single: async () => reply({ read_at: value === null ? null : stamp }) }) };
      },
    }) } as unknown as ReturnType<typeof beautyServerDatabase>;
  };
  const store = createConsultationReadStore(database);
  assert.deepEqual(await store.list([]), {}); assert.equal(calls, 0);
  assert.deepEqual(await store.list([id]), { [id]: stamp });
  assert.equal(await store.set(id, 'synthetic-admin', true), stamp);
  assert.equal(await store.set(id, 'synthetic-admin', false), null);
  for (const valid of [0, 2, '3']) { value = valid; assert.equal(await store.unreadCount(), Number(valid)); }
  for (const invalid of [null, '', 'bad', -1, Number.MAX_SAFE_INTEGER + 1]) {
    value = invalid; await assert.rejects(store.unreadCount(), /^Error: CONSULTATION_UNAVAILABLE$/);
  }
  value = null; await assert.rejects(store.set(id, 'synthetic-admin', true), /^Error: CONSULTATION_UNAVAILABLE$/);
  fail = true;
  for (const operation of [() => store.list([id]), () => store.set(id, 'synthetic-admin', true), () => store.set(id, 'synthetic-admin', false), () => store.unreadCount()]) {
    await assert.rejects(operation(), /^Error: CONSULTATION_UNAVAILABLE$/);
  }
});
