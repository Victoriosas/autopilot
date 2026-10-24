import test from 'node:test';
import assert from 'node:assert/strict';
import { validCamelRunDraft } from './consultationCamelRun';

const valid = {
  schema_version: '1.0',
  questions: ['¿Cuánto cuesta?'],
  services_candidates: ['orientacion'],
  knowledge_gaps: ['Tarifa no aprobada'],
  variants: {
    personalizada: 'Victoria deberá revisar el costo.',
    breve: 'Costo pendiente de confirmar.',
    orientacion: 'Se requiere evaluación inicial.',
  },
  guardian: { status: 'REQUIERE_VICTORIA', reasons: ['No hay fuentes aprobadas'] },
  action: 'BORRADOR_NO_ENVIADO',
};

test('camelRun only accepts supervised no-send drafts', () => {
  assert.equal(validCamelRunDraft(valid), true);
  assert.equal(validCamelRunDraft({ ...valid, action: 'ENVIAR' }), false);
  assert.equal(validCamelRunDraft({ ...valid, guardian: { ...valid.guardian, status: 'APTO' } }), false);
  assert.equal(validCamelRunDraft({ ...valid, variants: { ...valid.variants, breve: '' } }), false);
  assert.equal(validCamelRunDraft({ ...valid, questions: [null] }), false);
  assert.equal(validCamelRunDraft({ ...valid, schema_version: '2.0' }), false);
});
