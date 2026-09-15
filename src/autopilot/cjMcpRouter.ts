import { Router } from 'express';
import { requireSupabaseAdminAuth } from '../security/adminAuth';
import {
  CJ_MCP_BLOCKED_TOOLS,
  CJ_MCP_READ_ONLY_TOOLS,
  cjMcpShadowSafetyReady,
  getCJMcpReadOnlyClient,
} from '../services/cjMcp';

export function createCJMcpRouter(): Router {
  const router = Router();

  router.get('/status', requireSupabaseAdminAuth, async (req, res) => {
    try {
      const client = getCJMcpReadOnlyClient();
      const configured = Boolean(client);
      const safetyReady = cjMcpShadowSafetyReady();
      const shouldProbe = req.query.probe === '1' && configured && safetyReady;

      let probe: any = null;
      if (shouldProbe && client) {
        try {
          const tools = await client.listTools();
          const names = tools.map((tool: any) => String(tool?.name || '')).filter(Boolean);
          probe = {
            ok: true,
            discovered: names,
            availableReadOnly: CJ_MCP_READ_ONLY_TOOLS.filter((name) => names.includes(name)),
            missingExpected: CJ_MCP_READ_ONLY_TOOLS.filter((name) => !names.includes(name)),
          };
        } catch (error: any) {
          probe = { ok: false, error: error?.code || error?.message || 'CJ_MCP_PROBE_FAILED' };
        }
      }

      return res.json({
        provider: 'cj-official-mcp',
        configured,
        enabled: process.env.CJ_MCP_SHADOW_ENABLED === 'true',
        shadowOnly: true,
        safetyReady,
        restFallbackConfigured: Boolean(process.env.CJ_API_KEY?.trim()),
        allowedTools: CJ_MCP_READ_ONLY_TOOLS,
        blockedTools: CJ_MCP_BLOCKED_TOOLS,
        probe,
      });
    } catch (error: any) {
      return res.status(503).json({ error: error?.code || 'CJ_MCP_STATUS_UNAVAILABLE' });
    }
  });

  router.post('/call', requireSupabaseAdminAuth, async (req, res) => {
    if (!cjMcpShadowSafetyReady()) {
      return res.status(403).json({ error: 'CJ_MCP_SHADOW_SAFETY_NOT_READY' });
    }
    const tool = typeof req.body?.tool === 'string' ? req.body.tool.trim() : '';
    const args = req.body?.args && typeof req.body.args === 'object' && !Array.isArray(req.body.args)
      ? req.body.args
      : {};
    if (!tool) return res.status(400).json({ error: 'CJ_MCP_TOOL_REQUIRED' });
    if (!(CJ_MCP_READ_ONLY_TOOLS as readonly string[]).includes(tool)) {
      return res.status(403).json({ error: 'CJ_MCP_TOOL_BLOCKED', tool });
    }

    const client = getCJMcpReadOnlyClient();
    if (!client) return res.status(503).json({ error: 'CJ_MCP_NOT_CONFIGURED' });

    try {
      const result = await client.callReadOnlyTool(tool, args);
      return res.json({
        ok: true,
        provider: 'cj-official-mcp',
        shadow: true,
        readOnly: true,
        tool,
        result,
      });
    } catch (error: any) {
      return res.status(502).json({ error: error?.code || 'CJ_MCP_CALL_FAILED', tool });
    }
  });

  return router;
}
