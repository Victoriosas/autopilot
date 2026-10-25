// Evaluador offline-first de los agentes de consultas. Solo usa casos SINTÉTICOS.
// La parte pura (verificaciones) no usa red; la corrida real llama a camelRun con
// ejecuciones aisladas y sin estado, igual que el adaptador de producción.
import { createHash } from 'node:crypto';
import { validCamelRunDraft } from './consultationCamelRun';
import { AGENT_MODEL, COMPRENSION_PROMPT, GUARDIAN_PROMPT, REDACTOR_PROMPT } from './consultationAgentPrompts';

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
  if (!file || !Array.isArray(file.cases) || !Array.isArray(file.guardian_controls)) throw new Error('EVAL_FILE_INVALID');
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
  if (!(status in GUARDIAN_RANK)) return { issues: [{ code: 'GUARDIAN_INVALID', detail: String(status) }], warnings };
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
  fetchImpl: FetchLike, key: string, systemPrompt: string, input: unknown, requestId: string, spendLimit = 0.15,
): Promise<{ text: string; usage: RunUsage }> {
  const started = Date.now();
  const response = await fetchImpl('https://run.camelai.com/v1/runs', {
    method: 'POST', signal: AbortSignal.timeout(90000),
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`, 'Idempotency-Key': `victoriosas-eval-${requestId}` },
    body: JSON.stringify({ systemPrompt, model: AGENT_MODEL, input: JSON.stringify(input), wait: 60, retentionSeconds: 3600, spendLimit }),
  });
  if (!response.ok) throw new Error('CAMELRUN_UNAVAILABLE');
  const run: any = await response.json();
  if (run.status !== 'completed' && run.state !== 'completed') throw new Error('CAMELRUN_PENDING');
  return { text: String(run.text ?? run.outcome?.result?.reply ?? ''), usage: { costUsd: Number(run.usage?.costUsd ?? 0), ms: Date.now() - started } };
}

const parseStrict = (t: string) => { try { return JSON.parse(t); } catch { return null; } };

export type CaseResult = {
  id: string; family: string; critical: boolean; pass: boolean; issues: Issue[]; warnings: Issue[];
  guardian_status?: string; cost_usd: number; ms: number; error?: string;
};

export async function runCase(fetchImpl: FetchLike, key: string, c: EvalCase): Promise<CaseResult> {
  const r: CaseResult = { id: c.id, family: c.family, critical: c.critical, pass: false, issues: [], warnings: [], cost_usd: 0, ms: 0 };
  try {
    const a = await statelessRun(fetchImpl, key, COMPRENSION_PROMPT, { consulta: c.message }, `${c.id}-a`);
    const interp = parseStrict(a.text);
    const b = await statelessRun(fetchImpl, key, REDACTOR_PROMPT,
      { consulta: c.message, interpretacion: interp, evidencia_aprobada: c.evidence }, `${c.id}-b`);
    const draft = parseStrict(b.text);
    const g = await statelessRun(fetchImpl, key, GUARDIAN_PROMPT,
      { consulta: c.message, interpretacion: interp, evidencia_aprobada: c.evidence, borradores: draft?.variants ?? null }, `${c.id}-c`);
    const guard = parseStrict(g.text);
    r.cost_usd = a.usage.costUsd + b.usage.costUsd + g.usage.costUsd;
    r.ms = a.usage.ms + b.usage.ms + g.usage.ms;
    if (!interp) r.issues.push({ code: 'COMPRENSION_INVALID_JSON', detail: '' });
    if (!draft) r.issues.push({ code: 'REDACTOR_INVALID_JSON', detail: '' }); else r.issues.push(...checkDraft(c, draft));
    const cg = checkGuardian(c, guard);
    r.issues.push(...cg.issues); r.warnings.push(...cg.warnings); r.guardian_status = guard?.global_status;
  } catch (e: any) {
    r.error = e?.message ?? 'ERROR'; r.issues.push({ code: 'RUN_ERROR', detail: r.error });
  }
  r.pass = r.issues.length === 0;
  return r;
}

export async function runControl(fetchImpl: FetchLike, key: string, ctl: GuardianControl) {
  try {
    const g = await statelessRun(fetchImpl, key, GUARDIAN_PROMPT,
      { consulta: ctl.message, interpretacion: null, evidencia_aprobada: ctl.evidence, borradores: ctl.drafts }, `${ctl.id}`);
    const issues = checkControl(ctl, parseStrict(g.text));
    return { id: ctl.id, family: ctl.family, pass: issues.length === 0, issues, cost_usd: g.usage.costUsd };
  } catch (e: any) {
    return { id: ctl.id, family: ctl.family, pass: false, issues: [{ code: 'RUN_ERROR', detail: e?.message ?? 'ERROR' }], cost_usd: 0 };
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
    gate_ok: critical.every(r => r.pass) && controls.every(x => x.pass),
  };
}
