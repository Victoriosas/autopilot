// Provider-neutral, server-only model gateway. No automatic sending or database writes.
// Evaluation and draft generation must still pass deterministic guards and human approval.
export type ModelRequest = {
  systemPrompt: string;
  input: unknown;
  requestId: string;
};
export type ModelResponse = { text: string; provider: 'ollama' | 'openai-compatible' };
export type ModelGatewayConfig = {
  provider: 'ollama' | 'openai-compatible';
  endpoint: string;
  model: string;
  apiKey?: string;
};
const isLocal = (url: URL) => ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);
const requestIdValid = (v: string) => /^[a-zA-Z0-9_-]{8,100}$/.test(v);
export function validateModelGatewayConfig(config: ModelGatewayConfig): URL {
  if (!config.model || config.model.length > 128 || !/^[a-zA-Z0-9._:/-]+$/.test(config.model)) throw new Error('MODEL_INVALID');
  let url: URL;
  try { url = new URL(config.endpoint); } catch { throw new Error('MODEL_ENDPOINT_INVALID'); }
  if (url.username || url.password || url.search || url.hash) throw new Error('MODEL_ENDPOINT_INVALID');
  if (config.provider === 'ollama') {
    if (!isLocal(url) || url.protocol !== 'http:') throw new Error('MODEL_LOCAL_ONLY');
  } else if (config.provider === 'openai-compatible') {
    if (url.protocol !== 'https:' || isLocal(url) || !config.apiKey) throw new Error('MODEL_REMOTE_INVALID');
  } else throw new Error('MODEL_PROVIDER_INVALID');
  return url;
}
export async function runModelGateway(
  config: ModelGatewayConfig, req: ModelRequest,
  fetchImpl: typeof fetch = fetch,
): Promise<ModelResponse> {
  if (process.env.CONSULTATION_MODEL_GATEWAY_ENABLED !== 'true') throw new Error('MODEL_GATEWAY_DISABLED');
  if (!requestIdValid(req.requestId) || typeof req.systemPrompt !== 'string' || !req.systemPrompt.trim()) {
    throw new Error('MODEL_REQUEST_INVALID');
  }
  const endpoint = validateModelGatewayConfig(config);
  const path = config.provider === 'ollama' ? '/api/chat' : '/v1/chat/completions';
  const body = config.provider === 'ollama'
    ? { model: config.model, stream: false, messages: [{ role: 'system', content: req.systemPrompt }, { role: 'user', content: JSON.stringify(req.input) }] }
    : { model: config.model, stream: false, temperature: 0, messages: [{ role: 'system', content: req.systemPrompt }, { role: 'user', content: JSON.stringify(req.input) }] };
  const res = await fetchImpl(new URL(path, endpoint).toString(), {
    method: 'POST', signal: AbortSignal.timeout(30000),
    headers: { 'content-type': 'application/json', ...(config.apiKey && config.provider !== 'ollama' ? { authorization: 'Bearer ' + config.apiKey } : {}) },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error('MODEL_PROVIDER_UNAVAILABLE');
  const data: any = await res.json();
  const text = config.provider === 'ollama' ? data?.message?.content : data?.choices?.[0]?.message?.content;
  if (typeof text !== 'string' || !text.trim() || text.length > 24000) throw new Error('MODEL_RESPONSE_INVALID');
  return { text, provider: config.provider };
}
