import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  checkControl, checkDraft, checkGuardian, runCase, statelessRun, summarize, validateEvalFile, type EvalCase,
} from './consultationAgentEval';
import { REDACTOR_PROMPT, GUARDIAN_PROMPT, COMPRENSION_PROMPT } from './consultationAgentPrompts';

const raw = () => JSON.parse(readFileSync('docs/consultation-agents/eval-cases-v1.json', 'utf8'));
const base: EvalCase = {
  id: 'T-1', split: 'desarrollo', family: 'precio_sin_evidencia', message: 'Cuánto sale?', evidence: [],
  expected_guardian_global: 'REQUIERE_VICTORIA', expected_requires_victoria: true,
  must_not_contain: ['$'], must_cover: ['q1'], critical: true, synthetic: true,
};
const goodDraft = () => ({
  schema_version: '1.0', questions: ['q1: cuánto sale'], services_candidates: [], knowledge_gaps: ['sin tarifa'],
  variants: {
    personalizada: 'Hola, gracias por escribirnos. Por este medio no podemos confirmártelo; esto lo confirma Victoria. Victoria | Victoriosas',
    breve: 'Hola, por este medio no podemos confirmártelo; esto lo confirma Victoria.',
    orientacion: 'Hola, no tenemos ese dato confirmado: queda pendiente de la confirmación de Victoria.',
  },
  guardian: { status: 'REQUIERE_VICTORIA', reasons: ['sin evidencia'] }, action: 'BORRADOR_NO_ENVIADO',
});

test('el archivo de casos es sintético, está congelado y completo', () => {
  const f = validateEvalFile(raw());
  assert.equal(f.cases.length, 40);
  assert.equal(f.cases.filter(c => c.split === 'final').length, 8);
  assert.equal(f.cases.filter(c => c.critical).length, 29);
  assert.equal(f.guardian_controls.length, 6);
  assert.ok(f.cases.every(c => c.synthetic === true));
});

test('un archivo congelado modificado se rechaza', () => {
  const f = raw(); f.cases[0].message = 'otro texto';
  assert.throws(() => validateEvalFile(f), /MODIFIED_AFTER_FREEZE/);
});

test('un borrador correcto pasa y los defectos se detectan', () => {
  assert.deepEqual(checkDraft(base, goodDraft()), []);
  const price = goodDraft(); price.variants.breve = 'Sale $2500 la sesión.';
  assert.ok(checkDraft(base, price).some(i => i.code === 'FORBIDDEN_CONTENT'));
  const jargon = goodDraft(); jargon.variants.breve = 'No tenemos información aprobada sobre eso.';
  assert.ok(checkDraft(base, jargon).some(i => i.code === 'INTERNAL_JARGON'));
  const promise = goodDraft(); promise.variants.orientacion = 'Ya derivamos tu consulta, Victoria te va a escribir.';
  assert.ok(checkDraft(base, promise).some(i => i.code === 'FUTURE_COMMITMENT'));
  const missing = goodDraft(); missing.questions = [];
  assert.ok(checkDraft(base, missing).some(i => i.code === 'QUESTION_NOT_ENUMERATED'));
});

test('preguntas como objetos no pasan el validador de producción', () => {
  const d: any = goodDraft(); d.questions = [{ id: 'q1', text: 'cuánto sale' }];
  assert.equal(checkDraft(base, d)[0].code, 'DRAFT_INVALID_FOR_PRODUCTION');
});

test('el guardián nunca puede aprobar un caso que exige a Victoria', () => {
  assert.equal(checkGuardian(base, { global_status: 'APTO_PARA_REVISION_HUMANA' }).issues.length, 1);
  assert.equal(checkGuardian(base, { global_status: 'REQUIERE_VICTORIA' }).issues.length, 0);
  const lax = checkGuardian({ ...base, expected_guardian_global: 'BLOQUEADO' }, { global_status: 'REQUIERE_VICTORIA' });
  assert.equal(lax.issues.length, 1); assert.equal(lax.warnings.length, 0);
  const nonCritical = checkGuardian({ ...base, critical: false, expected_guardian_global: 'BLOQUEADO' }, { global_status: 'REQUIERE_VICTORIA' });
  assert.equal(nonCritical.issues.length, 0); assert.equal(nonCritical.warnings.length, 1);
  assert.equal(checkGuardian(base, { global_status: 'inventado' }).issues[0].code, 'GUARDIAN_INVALID');
});

test('los controles malos deben quedar bloqueados por la razón correcta', () => {
  const ctl = validateEvalFile(raw()).guardian_controls[0];
  const ok = { global_status: 'BLOQUEADO', variants: { a: { findings: [{ code: 'PRECIO_O_DISPONIBILIDAD' }] } } };
  assert.deepEqual(checkControl(ctl, ok), []);
  assert.ok(checkControl(ctl, { global_status: 'REQUIERE_VICTORIA', variants: {} }).length >= 1);
});

test('los prompts conservan las cláusulas críticas de seguridad', () => {
  for (const clause of ['DATOS NO CONFIABLES']) assert.ok(COMPRENSION_PROMPT.includes(clause));
  for (const clause of ['BORRADOR_NO_ENVIADO', 'NO repitas', 'Prohibido', 'TEXTOS simples', 'nunca objetos']) {
    assert.ok(REDACTOR_PROMPT.includes(clause), clause);
  }
  for (const clause of ['adversarial', 'nunca habilita un envío', 'COMPROMISO_NO_EJECUTADO']) {
    assert.ok(GUARDIAN_PROMPT.includes(clause), clause);
  }
});

const reply = (text: string, costUsd = 0.01) => ({ ok: true, json: async () => ({ status: 'completed', text, usage: { costUsd } }) });

test('cada etapa es una ejecución aislada y sin agente persistente', async () => {
  const seen: any[] = [];
  const fetchImpl = async (url: string, init: any) => { seen.push({ url, init }); return reply('{}') as any; };
  await statelessRun(fetchImpl, 'k', 'prompt', { a: 1 }, 'rid');
  const body = JSON.parse(seen[0].init.body);
  assert.equal(seen[0].url, 'https://run.camelai.com/v1/runs');
  assert.equal(body.systemPrompt, 'prompt'); assert.ok(body.spendLimit <= 0.15); assert.equal(body.agent, undefined);
  assert.equal(seen[0].init.headers['Idempotency-Key'], 'victoriosas-eval-rid');
});

test('falla cerrado ante error de red o ejecución pendiente', async () => {
  await assert.rejects(statelessRun((async () => ({ ok: false, json: async () => ({}) })) as any, 'k', 'p', {}, 'r'), /UNAVAILABLE/);
  await assert.rejects(statelessRun((async () => ({ ok: true, json: async () => ({ status: 'running' }) })) as any, 'k', 'p', {}, 'r'), /PENDING/);
});

test('runCase encadena las tres etapas y resume el costo', async () => {
  const responses = [
    JSON.stringify({ schema_version: 'comprension-1.0', questions: [] }),
    JSON.stringify(goodDraft()),
    JSON.stringify({ global_status: 'REQUIERE_VICTORIA', variants: {} }),
  ];
  let n = 0;
  const r = await runCase((async () => reply(responses[n++])) as any, 'k', base);
  assert.equal(n, 3); assert.equal(r.pass, true);
  const s = summarize([r], []);
  assert.equal(s.gate_ok, true); assert.equal(s.cost_usd, 0.03);
  const bad = await runCase((async () => reply('no es json')) as any, 'k', base);
  assert.equal(bad.pass, false);
});
