import test from 'node:test';
import assert from 'node:assert/strict';
import { consultationReplyStatus } from './consultationReplyStatus';

test('checking an empty outbox preserves human approval without claiming delivery', () => {
  const state = consultationReplyStatus({ reply: null });
  assert.equal(state.canApprove, true);
  assert.equal(state.accepted, false);
});
test('provider acceptance cannot be presented as delivery, human receipt or AI response', () => {
  const state = consultationReplyStatus({ reply: { state: 'sent' } });
  assert.equal(state.canApprove, false);
  assert.equal(state.accepted, true);
  assert.match(state.label, /aceptado por Resend/);
  assert.match(state.label, /Entrega y recepción humana sin confirmar/);
  assert.doesNotMatch(state.label, /respondida|por IA/i);
});
test('pending, uncertain, missing and malformed history cannot enable a duplicate send', () => {
  for (const payload of [undefined, null, {}, { reply: undefined }, { reply: false },
    { reply: { state: 'sending' } }, { reply: { state: 'failed_unknown' } },
    { reply: { state: 'delivered' } }, { reply: { state: 'unexpected' } }]) {
    assert.equal(consultationReplyStatus(payload).canApprove, false);
  }
});
