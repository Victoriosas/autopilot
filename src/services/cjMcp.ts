type JsonRpcResponse = {
  jsonrpc?: string;
  id?: string | number | null;
  result?: any;
  error?: { code?: number; message?: string; data?: unknown };
};

/**
 * Explicit read-only allowlist for CJ's documented remote MCP server.
 * Keep this list intentionally smaller than tools/list: the sourcing bridge must
 * never gain write capability simply because CJ adds a new remote tool.
 */
export const CJ_MCP_READ_ONLY_TOOLS = [
  'search_products',
  'query_sku_details',
  'get_order_list',
  'get_pay_order_list',
  'calculate_freight',
  'get_logistics_timeliness',
  'get_warehouses',
  'list_shops',
  'list_disputes',
  'get_dispute_detail',
  'check_login_status',
] as const;

export const CJ_MCP_BLOCKED_TOOLS = [
  'create_order',
  'add_to_cart',
  'create_dispute',
  'cancel_dispute',
  'merge_orders',
  'verify_credentials',
  'create_sourcing',
  'create_product_connection',
  'disconnect_product',
  'save_product_to_shop',
] as const;

const READ_ONLY_SET = new Set<string>(CJ_MCP_READ_ONLY_TOOLS);
const OFFICIAL_HOSTS = new Set(['developers.cjdropshipping.com', 'developers.cjdropshipping.cn']);

export class CJMcpError extends Error {
  constructor(message: string, public code = 'CJ_MCP_ERROR') {
    super(message);
  }
}

/**
 * CJ's current remote MCP route parser recognizes structural direct-token URLs:
 *   MCP@{userId}@CJ:{accessToken}
 *   API@{userId}@CJ:{accessToken}
 * The delimiters must remain literal in the URL path. Encoding the whole token
 * turns @ / : into percent escapes and CJ rejects the route before MCP starts.
 */
function encodeCJMcpTokenPath(token: string): string {
  const trimmed = token.trim();
  const structured = trimmed.match(/^(API|MCP)@([^@]+)@CJ:(.+)$/s);
  if (!structured) return encodeURIComponent(trimmed);

  const [, prefix, userId, accessToken] = structured;
  return `${prefix}@${encodeURIComponent(userId)}@CJ:${encodeURIComponent(accessToken)}`;
}

export function resolveCJMcpUrl(env: NodeJS.ProcessEnv = process.env): string | null {
  const token = env.CJ_MCP_TOKEN?.trim();
  const raw = env.CJ_MCP_SERVER_URL?.trim()
    || (token
      ? `https://developers.cjdropshipping.com/mcp/${encodeCJMcpTokenPath(token)}`
      : '');
  if (!raw) return null;

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new CJMcpError('CJ_MCP_URL_INVALID', 'CJ_MCP_URL_INVALID');
  }
  if (parsed.protocol !== 'https:' || !OFFICIAL_HOSTS.has(parsed.hostname) || !parsed.pathname.startsWith('/mcp/')) {
    throw new CJMcpError('CJ_MCP_URL_NOT_OFFICIAL', 'CJ_MCP_URL_NOT_OFFICIAL');
  }
  parsed.hash = '';
  parsed.search = '';
  return parsed.toString();
}

export function cjMcpShadowSafetyReady(env: NodeJS.ProcessEnv = process.env): boolean {
  const purchaseLimit = Number(env.AUTOPILOT_PURCHASE_LIMIT_USD || '0');
  return env.CJ_MCP_SHADOW_ENABLED === 'true'
    && env.AUTOPILOT_SHADOW_MODE !== 'false'
    && env.CHECKOUT_ENABLED !== 'true'
    && Number.isFinite(purchaseLimit)
    && purchaseLimit === 0
    && env.AUTOPILOT_LEGACY_SOURCING_ENABLED !== 'true';
}

function parseMcpPayload(text: string): JsonRpcResponse {
  const trimmed = text.trim();
  if (!trimmed) return { result: null };
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) {
      return parsed.find((item) => item && (item.result !== undefined || item.error)) || parsed[0] || { result: null };
    }
    return parsed;
  }

  const events = trimmed.split(/\r?\n/)
    .filter((line) => line.startsWith('data:'))
    .map((line) => line.slice(5).trim())
    .filter(Boolean)
    .map((line) => {
      try { return JSON.parse(line) as JsonRpcResponse; } catch { return null; }
    })
    .filter((value): value is JsonRpcResponse => Boolean(value));
  const response = [...events].reverse().find((item) => item.result !== undefined || item.error);
  if (!response) throw new CJMcpError('CJ_MCP_RESPONSE_UNREADABLE', 'CJ_MCP_RESPONSE_UNREADABLE');
  return response;
}

function parseJsonText(text: string): unknown {
  const trimmed = text.trim();
  if (!trimmed) throw new CJMcpError('CJ_MCP_EMPTY_TOOL_RESPONSE', 'CJ_MCP_EMPTY_TOOL_RESPONSE');
  try {
    return JSON.parse(trimmed);
  } catch {
    const objectStart = trimmed.indexOf('{');
    const objectEnd = trimmed.lastIndexOf('}');
    if (objectStart >= 0 && objectEnd > objectStart) {
      try { return JSON.parse(trimmed.slice(objectStart, objectEnd + 1)); } catch { /* continue */ }
    }
    const arrayStart = trimmed.indexOf('[');
    const arrayEnd = trimmed.lastIndexOf(']');
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      try { return JSON.parse(trimmed.slice(arrayStart, arrayEnd + 1)); } catch { /* continue */ }
    }
    throw new CJMcpError('CJ_MCP_TOOL_JSON_UNREADABLE', 'CJ_MCP_TOOL_JSON_UNREADABLE');
  }
}

export function extractCJMcpToolJson(result: any): unknown {
  if (result?.structuredContent && typeof result.structuredContent === 'object') {
    return result.structuredContent;
  }
  const textParts = Array.isArray(result?.content)
    ? result.content.filter((part: any) => part?.type === 'text' && typeof part.text === 'string').map((part: any) => part.text)
    : [];
  if (!textParts.length) throw new CJMcpError('CJ_MCP_TOOL_TEXT_MISSING', 'CJ_MCP_TOOL_TEXT_MISSING');
  for (const text of textParts) {
    try { return parseJsonText(text); } catch { /* try next text part */ }
  }
  throw new CJMcpError('CJ_MCP_TOOL_JSON_UNREADABLE', 'CJ_MCP_TOOL_JSON_UNREADABLE');
}

export class CJMcpReadOnlyClient {
  private requestId = 0;

  constructor(
    private readonly serverUrl: string,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    const validated = resolveCJMcpUrl({ CJ_MCP_SERVER_URL: serverUrl } as NodeJS.ProcessEnv);
    if (!validated) throw new CJMcpError('CJ_MCP_URL_REQUIRED', 'CJ_MCP_URL_REQUIRED');
    this.serverUrl = validated;
  }

  private async rpc(method: string, params?: Record<string, unknown>): Promise<any> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    try {
      const id = ++this.requestId;
      const response = await this.fetchImpl(this.serverUrl, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'accept': 'application/json, text/event-stream',
          'mcp-protocol-version': '2025-03-26',
        },
        body: JSON.stringify({ jsonrpc: '2.0', id, method, ...(params ? { params } : {}) }),
        signal: controller.signal,
      });
      const text = await response.text();
      if (!response.ok) {
        throw new CJMcpError(`CJ_MCP_HTTP_${response.status}`, `CJ_MCP_HTTP_${response.status}`);
      }
      const payload = parseMcpPayload(text);
      if (payload.error) {
        throw new CJMcpError(payload.error.message || 'CJ_MCP_RPC_ERROR', `CJ_MCP_RPC_${payload.error.code ?? 'UNKNOWN'}`);
      }
      return payload.result;
    } catch (error: any) {
      if (error?.name === 'AbortError') throw new CJMcpError('CJ_MCP_TIMEOUT', 'CJ_MCP_TIMEOUT');
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }

  async listTools(): Promise<any[]> {
    const result = await this.rpc('tools/list');
    return Array.isArray(result?.tools) ? result.tools : [];
  }

  async callReadOnlyTool(name: string, args: Record<string, unknown> = {}): Promise<any> {
    if (!READ_ONLY_SET.has(name)) {
      throw new CJMcpError(`CJ_MCP_TOOL_BLOCKED:${name}`, 'CJ_MCP_TOOL_BLOCKED');
    }
    const result = await this.rpc('tools/call', { name, arguments: args });
    if (result?.isError) throw new CJMcpError(`CJ_MCP_TOOL_ERROR:${name}`, 'CJ_MCP_TOOL_ERROR');
    return result;
  }

  async callReadOnlyJsonTool(name: string, args: Record<string, unknown> = {}): Promise<unknown> {
    return extractCJMcpToolJson(await this.callReadOnlyTool(name, args));
  }
}

export function getCJMcpReadOnlyClient(env: NodeJS.ProcessEnv = process.env): CJMcpReadOnlyClient | null {
  const url = resolveCJMcpUrl(env);
  return url ? new CJMcpReadOnlyClient(url) : null;
}
