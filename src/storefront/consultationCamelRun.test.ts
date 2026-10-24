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

test('camelRun fails closed when activation gates are disabled', async () => {
  const { camelRunConsultationDraft } = await import('./consultationCamelRun');
  const old = process.env.CAMELRUN_CONSULTATION_DRAFTS_ENABLED;
  process.env.CAMELRUN_CONSULTATION_DRAFTS_ENABLED = 'false';
  try {
    await assert.rejects(
      camelRunConsultationDraft({ message: 'Consulta de prueba', service: 'orientacion' }, 'sample'),
      /CAMELRUN_NOT_ENABLED/,
    );
  } finally {
    if (old === undefined) delete process.env.CAMELRUN_CONSULTATION_DRAFTS_ENABLED;
    else process.env.CAMELRUN_CONSULTATION_DRAFTS_ENABLED = old;
  }
});

test('legacy consultation consent does not authorize camelRun', async () => {
  const { camelRunConsultationDraft } = await import('./consultationCamelRun');
  const old = {
    enabled: process.env.CAMELRUN_CONSULTATION_DRAFTS_ENABLED,
    privacy: process.env.CONSULTATION_PRIVACY_APPROVED,
    processing: process.env.CAMELRUN_DATA_PROCESSING_APPROVED,
    key: process.env.CAMELAI_API_KEY,
  };
  process.env.CAMELRUN_CONSULTATION_DRAFTS_ENABLED = 'true';
  process.env.CONSULTATION_PRIVACY_APPROVED = 'true';
  process.env.CAMELRUN_DATA_PROCESSING_APPROVED = 'true';
  process.env.CAMELAI_API_KEY = 'synthetic-test-only';
  try {
    await assert.rejects(
      camelRunConsultationDraft({ message: 'Consulta sintética', service: 'orientacion', consentVersion: 'consultation-v1' }, 'synthetic'),
      /CAMELRUN_CONSENT_REQUIRED/,
    );
  } finally {
    const restore = (name: string, value: string | undefined) => {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    };
    restore('CAMELRUN_CONSULTATION_DRAFTS_ENABLED', old.enabled);
    restore('CONSULTATION_PRIVACY_APPROVED', old.privacy);
    restore('CAMELRUN_DATA_PROCESSING_APPROVED', old.processing);
    restore('CAMELAI_API_KEY', old.key);
  }
});
