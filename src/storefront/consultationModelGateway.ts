// Provider-neutral, server-only model gateway. No automatic sending or database writes.
// Evaluation and draft generation must still pass deterministic guards and human approval.
export type ModelRequest = {
  systemPrompt: string;
  input: unknown;
  requestId: string;
  schema?: Record<string, unknown>;
  signal?: AbortSignal;
};
export type ModelResponse = { text: string; provider: ModelGatewayConfig['provider']; latencyMs: number };
export type ModelGatewayConfig = {
  provider: 'ollama' | 'openai-compatible' | 'camelrun';
  endpoint: string;
  model: string;
  apiKey?: string;
  timeoutMs?: number;
  maxOutputTokens?: number;
  spendLimit?: number;
};
export async function boundedModelJSON(res: Response, maxBytes = 64000): Promise<any> {
  if (!res.body) return res.json(); // Minimal injected test transports.
  const reader = res.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  try { for (;;) { const item = await reader.read(); if (item.done) break; size += item.value.byteLength;
    if (size > maxBytes) throw new Error('MODEL_RESPONSE_INVALID'); chunks.push(item.value); } }
  finally { void reader.cancel().catch(() => {}); }
  try { const combined = new Uint8Array(size); let offset = 0; for (const chunk of chunks) { combined.set(chunk, offset); offset += chunk.byteLength; } return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(combined)); } catch { throw new Error('MODEL_RESPONSE_INVALID'); }
}
// Live catalog verification before spending. Reserve five bounded responses plus
// runtime/storage allowance; spendLimit alone is only a between-request cutoff.
export async function verifyCamelCost(fetchImpl: typeof fetch, key: string, model: string, reservation: number, signal?: AbortSignal) {
  const res = await fetchImpl('https://run.camelai.com/v1/models', { signal: signal ?? AbortSignal.timeout(10000), redirect: 'error', headers: { authorization: 'Bearer ' + key } });
  if (!res.ok) throw new Error('MODEL_PRICING_UNAVAILABLE');
  const catalog = await boundedModelJSON(res, 1024000);
  const selected = Array.isArray(catalog) ? catalog.find(v => v.id === model) : null;
  const cost = selected?.cost;
  if (!cost || ![cost.input,cost.output,cost.cacheWrite].every(v => typeof v === 'number' && Number.isFinite(v) && v >= 0) ||
      5 * (20000 * Math.max(cost.input,cost.cacheWrite) + 2048 * cost.output) / 1e6 + 0.001 > reservation) throw new Error('MODEL_COST_BOUND_UNVERIFIED');
}
const isLocal = (url: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
const requestIdValid = (v: string) => /^[a-zA-Z0-9_-]{8,100}$/.test(v);
export function validateModelGatewayConfig(config: ModelGatewayConfig): URL {
  if (!config.model || config.model.length > 128 || !/^[a-zA-Z0-9._:/-]+$/.test(config.model)) throw new Error('MODEL_INVALID');
  let url: URL;
  try { url = new URL(config.endpoint); } catch { throw new Error('MODEL_ENDPOINT_INVALID'); }
  if (url.username || url.password || url.search || url.hash) throw new Error('MODEL_ENDPOINT_INVALID');
  if (config.provider === 'ollama') {
    if (!isLocal(url) || url.protocol !== 'http:') throw new Error('MODEL_LOCAL_ONLY');
  } else if (config.provider === 'openai-compatible' || config.provider === 'camelrun') {
    if (url.protocol !== 'https:' || isLocal(url) || !config.apiKey || /[\r\n]/.test(config.apiKey)) throw new Error('MODEL_REMOTE_INVALID');
    if (config.provider === 'camelrun' && url.origin !== 'https://run.camelai.com') throw new Error('MODEL_REMOTE_INVALID');
  } else throw new Error('MODEL_PROVIDER_INVALID');
  if (url.pathname !== '/' || config.timeoutMs !== undefined && (!Number.isInteger(config.timeoutMs) || config.timeoutMs < 1 || config.timeoutMs > 45000) ||
      config.maxOutputTokens !== undefined && (!Number.isInteger(config.maxOutputTokens) || config.maxOutputTokens < 1 || config.maxOutputTokens > 4096)) throw new Error('MODEL_CONFIG_INVALID');
  if (config.provider === 'camelrun' && (!Number.isFinite(config.spendLimit) || config.spendLimit! <= 0 || config.spendLimit! > 0.15)) throw new Error('MODEL_BUDGET_INVALID');
  return url;
}
export async function runModelGateway(
  config: ModelGatewayConfig, req: ModelRequest,
  fetchImpl: typeof fetch = fetch,
  env: NodeJS.ProcessEnv = process.env,
): Promise<ModelResponse> {
  if (env.CONSULTATION_MODEL_GATEWAY_ENABLED !== 'true') throw new Error('MODEL_GATEWAY_DISABLED');
  if (config.provider !== 'ollama' && env.CONSULTATION_AI_REMOTE_AUTHORIZED !== 'true') throw new Error('MODEL_NOT_AUTHORIZED');
  if (!requestIdValid(req.requestId) || typeof req.systemPrompt !== 'string' || !req.systemPrompt.trim()) {
    throw new Error('MODEL_REQUEST_INVALID');
  }
  const endpoint = validateModelGatewayConfig(config);
  if (new TextEncoder().encode(JSON.stringify(req.input) ?? '').byteLength + new TextEncoder().encode(req.systemPrompt).byteLength > 12000) throw new Error('MODEL_INPUT_LIMIT');
  const path = config.provider === 'ollama' ? '/api/chat' : config.provider === 'camelrun' ? '/v1/runs' : '/v1/chat/completions';
  const messages = [{ role: 'system', content: req.systemPrompt }, { role: 'user', content: JSON.stringify(req.input) }];
  const body = config.provider === 'ollama'
    ? { model: config.model, stream: false, messages, format: req.schema ?? 'json', options: { temperature: 0, num_predict: config.maxOutputTokens ?? 2048 } }
    : config.provider === 'camelrun' ? { model: config.model, systemPrompt: req.systemPrompt, input: JSON.stringify(req.input), wait: 20, retentionSeconds: 60, spendLimit: { usd: config.spendLimit },
      maxOutputTokens: 2048, thinkingLevel: 'off', builtins: [], fileTools: false, codeMode: false,
      runLimits: { maxResponses: 1, maxSeconds: 30, contextTokens: 20000 }, ...(req.schema ? { output: { schema: req.schema } } : {}) }
    : { model: config.model, stream: false, store: false, temperature: 0, max_tokens: config.maxOutputTokens ?? 2048, messages,
      response_format: req.schema ? { type: 'json_schema', json_schema: { name: 'consultation', strict: true, schema: req.schema } } : { type: 'json_object' } };
  const started = Date.now(), timeout = AbortSignal.timeout(config.timeoutMs ?? 30000);
  const signal = req.signal ? AbortSignal.any([req.signal, timeout]) : timeout;
  const operation = async () => {
  const res = await fetchImpl(new URL(path, endpoint).toString(), {
    method: 'POST', signal, redirect: 'error',
    headers: { 'content-type': 'application/json', ...(config.apiKey && config.provider !== 'ollama' ? { authorization: 'Bearer ' + config.apiKey } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('MODEL_PROVIDER_UNAVAILABLE');
  const data = await boundedModelJSON(res);
  if (config.provider === 'camelrun' && data?.status !== 'completed' && data?.state !== 'completed') throw new Error('MODEL_PENDING');
  if (config.provider === 'ollama' && data?.done === false || config.provider === 'openai-compatible' && data?.choices?.[0]?.finish_reason && data.choices[0].finish_reason !== 'stop') throw new Error('MODEL_RESPONSE_INVALID');
  const text = config.provider === 'ollama' ? data?.message?.content : config.provider === 'camelrun' ? data?.output ? JSON.stringify(data.output) : data?.text ?? data?.outcome?.result?.reply : data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim() || text.length > 24000) throw new Error('MODEL_RESPONSE_INVALID');
  try { const parsed = JSON.parse(text); if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw Error(); } catch { throw new Error('MODEL_RESPONSE_INVALID'); }
  return { text, provider: config.provider, latencyMs: Date.now() - started };
  };
  let abort: (() => void) | undefined;
  try {
    if (signal.aborted) throw new Error('MODEL_TIMEOUT');
    return await Promise.race([operation(), new Promise<never>((_, reject) => {
      abort = () => reject(new Error('MODEL_TIMEOUT')); signal.addEventListener('abort', abort, { once: true });
    })]);
  } catch (error) {
    const code = error instanceof Error && /^MODEL_[A-Z_]+$/.test(error.message) ? error.message : 'MODEL_PROVIDER_UNAVAILABLE';
    throw new Error(code);
  } finally { if (abort) signal.removeEventListener('abort', abort); }
}
