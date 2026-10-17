// Read-only live connectivity probe. Never creates orders, writes DB rows or publishes.
import dotenv from 'dotenv';
import { getCJSourcingReadProvider } from '../src/services/cjSourcingProvider.ts';
import { cjMcpReadSafetyReady } from '../src/services/cjMcp.ts';

dotenv.config({ path: process.env.CJ_CHECK_ENV_FILE || '.env.local', quiet: true });
dotenv.config({ quiet: true });
const mode = process.env.AUTOPILOT_SHADOW_MODE === 'false' ? 'production' : 'shadow';
try {
  const provider = getCJSourcingReadProvider({ mode });
  console.log(JSON.stringify({
    restKeyPresent: Boolean(process.env.CJ_API_KEY?.trim()),
    mcpCredentialPresent: Boolean(process.env.CJ_MCP_TOKEN?.trim() || process.env.CJ_MCP_SERVER_URL?.trim()),
    mcpReadSafetyReady: cjMcpReadSafetyReady(),
    readOnly: true,
  }));
  if (!provider) throw Object.assign(new Error(), { code: 'CJ_READ_PROVIDER_NOT_CONFIGURED' });
  const result = await provider.searchProducts({ keyword: 'spa headband', pageNum: 1, pageSize: 1 });
  console.log(JSON.stringify({ ok: true, total: result.total, returned: result.products.length, trace: provider.drainTrace() }));
} catch (error) {
  const code = typeof error?.code === 'string' && /^[A-Z0-9_:-]{3,160}$/.test(error.code) ? error.code : 'CJ_CONNECTION_FAILED';
  console.log(JSON.stringify({ ok: false, code, status: error?.status,
    action: code.includes('1600005') ? 'REPLACE_CJ_API_KEY_OR_AUTHORIZE_CJ_API_STORE' : 'CHECK_PROVIDER_CONNECTIVITY_AND_CONFIGURATION' }));
  process.exitCode = 1;
}
