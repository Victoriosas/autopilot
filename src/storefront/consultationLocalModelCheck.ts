import { analyzeConsultation } from './consultationIntelligence';
import { intelligenceFixture } from './consultationIntelligence.fixtures';
import { configuredConsultationModel } from './consultationIntelligenceProviders';
import { boundedModelJSON, runModelGateway } from './consultationModelGateway';

type LocalModelCheck = {
  scope: 'synthetic_smoke_only'; fullEvaluation: false; ok: boolean;
  stage: 'model' | 'version' | 'installed' | 'chat' | 'analysis'; chat: boolean;
  model?: string; version?: string; error?: string;
  analysis?: { guardian: string; action: string; calls: number; codes: string[] };
};

// Diagnostic only: fixed loopback destination and synthetic input. No DB, secrets,
// model downloads, remote provider selection, production flags or delivery path.
export async function checkLocalConsultationModel(model: string, request: typeof fetch = fetch): Promise<LocalModelCheck> {
  const result: LocalModelCheck = { scope: 'synthetic_smoke_only', fullEvaluation: false, ok: false, stage: 'model', chat: false };
  try {
    if (!/^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/.test(model) || model.includes('..') || /(?:^|[-:])cloud(?:$|[-:])/i.test(model)) throw Error();
    result.model = model;
    const base = 'http://127.0.0.1:11434';
    const read = async (path: string) => {
      const res = await request(base + path, { method: 'GET', redirect: 'error', signal: AbortSignal.timeout(8000) });
      if (!res.ok) throw Error();
      return boundedModelJSON(res, 256000);
    };
    result.stage = 'version';
    const version = (await read('/api/version'))?.version;
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+$/.test(version)) throw Error();
    result.version = version;
    result.stage = 'installed';
    const tags = await read('/api/tags');
    const installed = Array.isArray(tags?.models) ? tags.models.find((v: any) => v?.name === model) : undefined;
    if (!installed || !Number.isSafeInteger(installed.size) || installed.size <= 0 || installed.remote_host || installed.remote_model) throw Error();
    // A fresh env object opens only this local diagnostic; never mutate process.env.
    const env = { CONSULTATION_MODEL_GATEWAY_ENABLED: 'true', CONSULTATION_AI_PROVIDER: 'ollama', CONSULTATION_AI_MODEL: model };
    result.stage = 'chat';
    const echo = await runModelGateway({ provider: 'ollama', endpoint: base, model, timeoutMs: 30000, maxOutputTokens: 32 }, {
      requestId: 'local_preflight_synthetic', systemPrompt: 'Return exactly the JSON object {"ok":true}. No tools or other text.',
      input: { synthetic: true }, schema: { type: 'object', properties: { ok: { type: 'boolean', const: true } }, required: ['ok'], additionalProperties: false },
    }, request, env);
    const value = JSON.parse(echo.text);
    if (Object.keys(value).length !== 1 || value.ok !== true) throw Error();
    result.chat = true;
    result.stage = 'analysis';
    const now = new Date();
    const record = { ...intelligenceFixture(), created_at: now.toISOString(), expires_at: new Date(+now + 86400000).toISOString() };
    const analysis = await analyzeConsultation(record, { now, provider: configuredConsultationModel(env, request) });
    result.analysis = { guardian: analysis.guardian.status, action: analysis.decision.action, calls: analysis.statistics.calls, codes: analysis.guardian.codes };
    result.ok = analysis.mode === 'shadow' && analysis.decision.action === 'no_send' && analysis.guardian.status === 'approved' && analysis.statistics.calls === 3;
  } catch {
    result.error = 'LOCAL_MODEL_CHECK_FAILED';
  }
  return result;
}
