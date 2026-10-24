// camelRun processes one isolated, stateless request. Never reuse the conversational
// supervisor across client records: its persistent history could mix private cases.
const PROMPT = `Sos un agente de borradores de Victoriosas, supervisado por Victoria.
Analizá todas las preguntas e intenciones. No uses web ni memoria de otras consultas.
No inventes precios, turnos, resultados, protocolos, diagnósticos ni promesas.
Sin evidencia aprobada explícita, marcá REQUIERE_VICTORIA y no afirmes que
se realizó una derivación, envío o reserva. Respondé en español uruguayo.
Devolvé SOLO JSON con:
{"schema_version":"1.0","questions":[],"services_candidates":[],
"knowledge_gaps":[],"variants":{"personalizada":"","breve":"","orientacion":""},
"guardian":{"status":"REQUIERE_VICTORIA","reasons":[]},"action":"BORRADOR_NO_ENVIADO"}.
La revisión semántica no sustituye controles deterministas ni autorización de envío.`;

export type AIDraft = {
  schema_version: string; questions: string[]; services_candidates: string[];
  knowledge_gaps: string[];
  variants: { personalizada: string; breve: string; orientacion: string };
  guardian: { status: string; reasons: string[] };
  action: string;
};

export function validCamelRunDraft(result: any): result is AIDraft {
  return result && result.schema_version === '1.0' &&
    Array.isArray(result.questions) && Array.isArray(result.services_candidates) &&
    Array.isArray(result.knowledge_gaps) &&
    result.questions.every((q: unknown) => typeof q === 'string') &&
    result.services_candidates.every((q: unknown) => typeof q === 'string') &&
    result.knowledge_gaps.every((q: unknown) => typeof q === 'string') &&
    result.variants && ['personalizada','breve','orientacion'].every(k =>
      typeof result.variants[k] === 'string' && result.variants[k].length > 0 && result.variants[k].length < 4000) &&
    result.guardian && result.guardian.status === 'REQUIERE_VICTORIA' &&
    Array.isArray(result.guardian.reasons) &&
    result.guardian.reasons.every((q: unknown) => typeof q === 'string') && result.action === 'BORRADOR_NO_ENVIADO';
}

export async function camelRunConsultationDraft(input: unknown, requestId: string): Promise<AIDraft> {
  if (process.env.CAMELRUN_CONSULTATION_DRAFTS_ENABLED !== 'true' ||
      process.env.CONSULTATION_PRIVACY_APPROVED !== 'true' ||
      process.env.CAMELRUN_DATA_PROCESSING_APPROVED !== 'true') {
    throw new Error('CAMELRUN_NOT_ENABLED');
  }
  const key = process.env.CAMELAI_API_KEY;
  if (!key) throw new Error('CAMELRUN_NOT_CONFIGURED');
  // Avoid sending metadata unrelated to the consultation, or logs with PII.
  const record = input as Record<string, unknown>;
  // Older consultation-v1 records never authorized disclosure to an AI vendor.
  if (record?.aiConsent !== true) throw new Error('CAMELRUN_CONSENT_REQUIRED');
  if (!record || typeof record.message !== 'string' || !record.message.trim()) throw new Error('CAMELRUN_INVALID_INPUT');
  const payload = JSON.stringify({
    systemPrompt: PROMPT,
    model: 'anthropic/claude-sonnet-5-5',
    input: JSON.stringify({ motive: typeof record?.message === 'string' ? record.message.slice(0, 600) : '',
      service: typeof record?.service === 'string' ? record.service.slice(0, 200) : '' }),
    wait: 20,
    retentionSeconds: 3600,
    spendLimit: 0.15,
  });
  const signal = AbortSignal.timeout(45000);
  const response = await fetch('https://run.camelai.com/v1/runs', {
    method: 'POST', signal,
    headers: { 'content-type': 'application/json', authorization: `Bearer ${key}`,
      'Idempotency-Key': `victoriosas-draft-${requestId}` },
    body: payload,
  });
  if (!response.ok) throw new Error('CAMELRUN_UNAVAILABLE');
  let run: any = await response.json();
  // Vercel execution time is bounded: fail closed rather than giving a partial draft.
  if (run.status !== 'completed' && run.state !== 'completed') {
    const id = typeof run.id === 'string' ? run.id : null;
    if (!id || !/^[a-zA-Z0-9_-]{8,128}$/.test(id)) throw new Error('CAMELRUN_PENDING');
    const follow = await fetch('https://run.camelai.com/v1/runs/' + encodeURIComponent(id) + '?wait=15', {
      signal, headers: { authorization: `Bearer ${key}` },
    });
    if (!follow.ok) throw new Error('CAMELRUN_UNAVAILABLE');
    run = await follow.json();
    if (run.status !== 'completed' && run.state !== 'completed') throw new Error('CAMELRUN_PENDING');
  }
  let draft: unknown;
  try { draft = JSON.parse(run.text ?? run.outcome?.result?.reply ?? ''); }
  catch { throw new Error('CAMELRUN_INVALID_OUTPUT'); }
  if (!validCamelRunDraft(draft)) throw new Error('CAMELRUN_INVALID_OUTPUT');
  return draft;
}
