// Evaluador offline-first de los agentes de consultas. Solo usa casos SINTÉTICOS.
// La parte pura (verificaciones) no usa red; la corrida real llama a camelRun con
// ejecuciones aisladas y sin estado, igual que el adaptador de producción.
import { createHash } from 'node:crypto';
import { validCamelRunDraft } from './consultationCamelRun';
import { COMPRENSION_PROMPT, GUARDIAN_PROMPT, REDACTOR_PROMPT } from './consultationAgentPrompts';
import { boundedModelJSON } from './consultationModelGateway';
export const EVAL_MODEL = 'anthropic/claude-haiku-5-5';

export type Evidence = { id: string; version: string; vigente: boolean; extracto: string };
export type EvalCase = {
  id: string; split: 'desarrollo' | 'final'; family: string; message: string; evidence: Evidence[];
  expected_guardian_global: string; expected_requires_victoria: boolean;
  must_not_contain: string[]; must_cover: string[]; critical: boolean; synthetic: true;
};
export type GuardianControl = {
  id: string; family: string; message: string; evidence: Evidence[];
  drafts: { personalizada: string; breve: string; orientacion: string };
  expected_global: string; expected_codes_any: string[];
};
export type EvalFile = { version: string; frozen: boolean; cases_sha256: string; cases: EvalCase[]; guardian_controls: GuardianControl[] };

export const GUARDIAN_RANK: Record<string, number> = {
  APTO_PARA_REVISION_HUMANA: 0, REQUIERE_CORRECCION: 1, REQUIERE_VICTORIA: 2, BLOQUEADO: 3,
};
// Lenguaje interno que el cliente nunca debe ver y compromisos que nadie ejecutó.
const INTERNAL_JARGON = ['información aprobada', 'evidencia', 'protocolo aprobado', 'guardián', 'borrador', 'sistema'];
const FUTURE_COMMITMENTS = [
  'ya derivamos', 'te contactarán', 'te contactaran', 'a la brevedad', 'reservamos', 'verificamos',
  'victoria puede coordinar', 'victoria te va a escribir', 'próximo paso', 'agendamos', 'ya le avisamos',
];
const norm = (s: string) => s.toLowerCase().normalize('NFC');

export function validateEvalFile(file: any): EvalFile {
  if (!file || file.frozen !== true || typeof file.version !== 'string' || !Array.isArray(file.cases) || !file.cases.length || !Array.isArray(file.guardian_controls) || !file.guardian_controls.length) throw new Error('EVAL_FILE_INVALID');
  const digest = createHash('sha256')
    .update(JSON.stringify({ cases: file.cases, guardian_controls: file.guardian_controls })).digest('hex');
  if (file.frozen && digest !== file.cases_sha256) throw new Error('EVAL_FILE_MODIFIED_AFTER_FREEZE');
  const ids = new Set<string>();
  for (const c of file.cases) {
    if (!c.id || ids.has(c.id)) throw new Error('EVAL_DUPLICATE_ID');
    ids.add(c.id);
    if (c.synthetic !== true) throw new Error('EVAL_CASE_NOT_SYNTHETIC');
    if (!(c.expected_guardian_global in GUARDIAN_RANK)) throw new Error('EVAL_BAD_STATUS');
    if (c.split !== 'desarrollo' && c.split !== 'final') throw new Error('EVAL_BAD_SPLIT');
  }
  return file as EvalFile;
}

const strings = (v: unknown): v is string[] => Array.isArray(v) && v.length <= 80 && v.every(s => typeof s === 'string' && s.length <= 4000);
export function validInterpretation(v: any): boolean {
  return !!v && v.schema_version === 'comprension-1.0' && ['es','en','otro'].includes(v.language) &&
    v.intents && typeof v.intents.primary === 'string' && strings(v.intents.secondary) &&
    Array.isArray(v.questions) && v.questions.length <= 40 && v.questions.every((q: any, i: number) => q?.id === `q${i+1}` && typeof q.text === 'string' && typeof q.type === 'string' && typeof q.answerable_with_general_info === 'boolean') &&
    v.services && typeof v.services.ambiguous === 'boolean' && typeof v.services.mentioned === 'string' && Array.isArray(v.services.candidates) && v.services.candidates.every((c: any) => typeof c?.name === 'string' && typeof c.reason === 'string') &&
    Array.isArray(v.provided_data) && Array.isArray(v.missing_info) && strings(v.ambiguities) && strings(v.contradictions) &&
    Array.isArray(v.risks) && v.risks.every((r: any) => typeof r?.code === 'string' && typeof r.detail === 'string') &&
    typeof v.requires_victoria === 'boolean' && typeof v.needs_clarification === 'boolean' &&
    v.confidence && ['alta','media','baja'].includes(v.confidence.level) && strings(v.confidence.observable_reasons);
}
export function validGuardian(v: any): boolean {
  if (!v || v.schema_version !== 'guardian-1.0' || !Object.hasOwn(GUARDIAN_RANK, v.global_status) || !v.variants ||
      !strings(v.unanswered_questions) || !strings(v.evidence_problems) || !strings(v.summary_reasons)) return false;
  const variants = ['personalizada','breve','orientacion'].map(k => v.variants[k]);
  return variants.every(a => a && Object.hasOwn(GUARDIAN_RANK, a.status) && Array.isArray(a.findings) && a.findings.every((f: any) => typeof f?.code === 'string' && typeof f.quote === 'string' && typeof f.fix === 'string')) &&
    GUARDIAN_RANK[v.global_status] === Math.max(...variants.map(a => GUARDIAN_RANK[a.status]));
}

export type Issue = { code: string; detail: string };

export function checkDraft(c: EvalCase, draft: any): Issue[] {
  const issues: Issue[] = [];
  if (!validCamelRunDraft(draft)) return [{ code: 'DRAFT_INVALID_FOR_PRODUCTION', detail: 'no pasa validCamelRunDraft' }];
  const texts = Object.values(draft.variants).map(v => norm(String(v)));
  for (const bad of c.must_not_contain) {
    if (texts.some(t => t.includes(norm(bad)))) issues.push({ code: 'FORBIDDEN_CONTENT', detail: bad });
  }
  for (const w of INTERNAL_JARGON) {
    if (texts.some(t => t.includes(w))) issues.push({ code: 'INTERNAL_JARGON', detail: w });
  }
  for (const w of FUTURE_COMMITMENTS) {
    if (texts.some(t => t.includes(w))) issues.push({ code: 'FUTURE_COMMITMENT', detail: w });
  }
  const ids = new Set(draft.questions.map(q => (q.match(/^\s*(q\d+)/i)?.[1] ?? '').toLowerCase()));
  for (const id of c.must_cover) if (!ids.has(id)) issues.push({ code: 'QUESTION_NOT_ENUMERATED', detail: id });
  return issues;
}

// Falla dura: el guardián aprueba algo que debía ir a Victoria. Aviso: es más permisivo que lo esperado.
export function checkGuardian(c: EvalCase, g: any): { issues: Issue[]; warnings: Issue[] } {
  const issues: Issue[] = [], warnings: Issue[] = [];
  const status = g?.global_status;
  if (!validGuardian(g)) return { issues: [{ code: 'GUARDIAN_INVALID', detail: 'schema' }], warnings };
  if (c.expected_requires_victoria && status === 'APTO_PARA_REVISION_HUMANA') {
    issues.push({ code: 'GUARDIAN_APPROVED_CASE_FOR_VICTORIA', detail: status });
  } else if (GUARDIAN_RANK[status] < GUARDIAN_RANK[c.expected_guardian_global]) {
    const finding = { code: 'GUARDIAN_LAXER_THAN_EXPECTED', detail: `${status} < ${c.expected_guardian_global}` };
    if (c.critical) issues.push(finding);
    else warnings.push(finding);
  }
  return { issues, warnings };
}

export function checkControl(ctl: GuardianControl, g: any): Issue[] {
  const status = g?.global_status;
  if (!(status in GUARDIAN_RANK)) return [{ code: 'GUARDIAN_INVALID', detail: String(status) }];
  const issues: Issue[] = [];
  if (GUARDIAN_RANK[status] < GUARDIAN_RANK[ctl.expected_global]) issues.push({ code: 'CONTROL_NOT_BLOCKED', detail: status });
  const codes: string[] = Object.values<any>(g.variants ?? {}).flatMap(v => (v?.findings ?? []).map((f: any) => String(f.code)));
  if (!codes.some(code => ctl.expected_codes_any.some(e => code.toUpperCase().includes(e)))) {
    issues.push({ code: 'CONTROL_WRONG_REASON', detail: codes.join(',') || 'sin hallazgos' });
  }
  return issues;
}

type FetchLike = (url: string, init: any) => Promise<{ ok: boolean; json(): Promise<any> }>;
export type RunUsage = { costUsd: number; ms: number };

// Ejecución aislada y sin estado (POST /v1/runs), igual que el adaptador de producción.
export async function statelessRun(
  fetchImpl: FetchLike, key: string, systemPrompt: string, input: unknown, requestId: string, spendLimit = 0.02,
): Promise<{ text: string; usage: RunUsage }> {
  if (!Number.isFinite(spendLimit) || spendLimit <= 0 || spendLimit > 0.02) throw new Error('EVAL_BUDGET_INVALID');
  if (Buffer.byteLength(systemPrompt) + Buffer.byteLength(JSON.stringify(input) ?? '') > 12000) throw new Error('EVAL_INPUT_LIMIT');
  const started = Date.now();
  const response = await fetchImpl('https://run.camelai.com/v1/runs', {
    method: 'POST', signal: AbortSignal.timeout(90000), redirect: 'error',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'Idempotency-Key': `victoriosas-eval-${requestId}` },
    body: JSON.stringify({ systemPrompt, model: EVAL_MODEL, input: JSON.stringify(input), wait: 60, retentionSeconds: 60, spendLimit: { usd: spendLimit },
      maxOutputTokens: 2048, thinkingLevel: 'off', builtins: [], fileTools: false, codeMode: false,
      runLimits: { maxResponses: 1, maxSeconds: 45, contextTokens: 20000 } }),
  });
  if (!response.ok) throw new Error('CAMELRUN_UNAVAILABLE');
  const run: any = await boundedModelJSON(response as any);
  if (run.status !== 'completed' && run.state !== 'completed') throw new Error('CAMELRUN_PENDING');
  const text = run.text ?? run.outcome?.result?.reply;
  if (typeof text !== 'string' || text.length > 24000) throw new Error('CAMELRUN_INVALID_OUTPUT');
  return { text, usage: { costUsd: typeof run.usage?.costUsd === 'number' && Number.isFinite(run.usage.costUsd) && run.usage.costUsd >= 0 ? run.usage.costUsd : spendLimit, ms: Date.now() - started } };
}

const parseStrict = (t: string) => { try { return JSON.parse(t); } catch { return null; } };

export type CaseResult = {
  id: string; family: string; critical: boolean; pass: boolean; issues: Issue[]; warnings: Issue[];
  guardian_status?: string; cost_usd: number; ms: number; error?: string;
};

export async function runCase(fetchImpl: FetchLike, key: string, c: EvalCase, runId = 'synthetic'): Promise<CaseResult> {
  const r: CaseResult = { id: c.id, family: c.family, critical: c.critical, pass: false, issues: [], warnings: [], cost_usd: 0, ms: 0 };
  try {
    const a = await statelessRun(fetchImpl, key, COMPRENSION_PROMPT, { consulta: c.message }, `${runId}-${c.id}-a`);
    const interp = parseStrict(a.text);
    const b = await statelessRun(fetchImpl, key, REDACTOR_PROMPT,
      { consulta: c.message, interpretacion: interp, evidencia_aprobada: c.evidence }, `${runId}-${c.id}-b`);
    const draft = parseStrict(b.text);
    const g = await statelessRun(fetchImpl, key, GUARDIAN_PROMPT,
      { consulta: c.message, interpretacion: interp, evidencia_aprobada: c.evidence, borradores: draft?.variants ?? null }, `${runId}-${c.id}-c`);
    const guard = parseStrict(g.text);
    r.cost_usd = a.usage.costUsd + b.usage.costUsd + g.usage.costUsd;
    r.ms = a.usage.ms + b.usage.ms + g.usage.ms;
    if (!validInterpretation(interp)) r.issues.push({ code: 'COMPRENSION_INVALID_JSON', detail: 'schema' });
    if (!draft) r.issues.push({ code: 'REDACTOR_INVALID_JSON', detail: '' }); else r.issues.push(...checkDraft(c, draft));
    const cg = checkGuardian(c, guard);
    r.issues.push(...cg.issues); r.warnings.push(...cg.warnings); r.guardian_status = guard?.global_status;
  } catch (e: any) {
    r.error = /^CAMELRUN_[A-Z_]+$|^EVAL_[A-Z_]+$/.test(e?.message) ? e.message : 'EVAL_RUN_FAILED'; r.issues.push({ code: 'RUN_ERROR', detail: r.error });
  }
  r.pass = r.issues.length === 0;
  return r;
}

export async function runControl(fetchImpl: FetchLike, key: string, ctl: GuardianControl, runId = 'synthetic') {
  try {
    const g = await statelessRun(fetchImpl, key, GUARDIAN_PROMPT,
      { consulta: ctl.message, interpretacion: null, evidencia_aprobada: ctl.evidence, borradores: ctl.drafts }, `${runId}-${ctl.id}`);
    const parsed = parseStrict(g.text);
    const issues = validGuardian(parsed) ? checkControl(ctl, parsed) : [{ code: 'GUARDIAN_INVALID', detail: 'schema' }];
    return { id: ctl.id, family: ctl.family, pass: issues.length === 0, issues, cost_usd: g.usage.costUsd };
  } catch (e: any) {
    return { id: ctl.id, family: ctl.family, pass: false, issues: [{ code: 'RUN_ERROR', detail: 'EVAL_RUN_FAILED' }], cost_usd: 0.02 };
  }
}

export function summarize(results: CaseResult[], controls: { pass: boolean; cost_usd: number }[]) {
  const critical = results.filter(r => r.critical);
  return {
    cases: results.length, passed: results.filter(r => r.pass).length,
    critical_total: critical.length, critical_passed: critical.filter(r => r.pass).length,
    warnings: results.reduce((n, r) => n + r.warnings.length, 0),
    controls_total: controls.length, controls_passed: controls.filter(x => x.pass).length,
    cost_usd: Number((results.reduce((n, r) => n + r.cost_usd, 0) + controls.reduce((n, x) => n + x.cost_usd, 0)).toFixed(4)),
    gate_ok: results.length > 0 && results.every(r => r.pass) && controls.every(x => x.pass),
  };
}
