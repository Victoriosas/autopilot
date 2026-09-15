import { Router } from 'express';
import { requireSupabaseAdminAuth } from '../security/adminAuth';

function configured(...names: string[]) {
  return names.every((name) => Boolean(process.env[name]?.trim()));
}

export function createConnectorDirectoryRouter(): Router {
  const router = Router();

  router.use(requireSupabaseAdminAuth);

  router.get('/', (_req, res) => {
    const now = new Date().toISOString();
    const cjRest = configured('CJ_API_KEY');
    const cjMcp = Boolean(process.env.CJ_MCP_TOKEN?.trim() || process.env.CJ_MCP_SERVER_URL?.trim());
    const aliExpress = configured('ALIEXPRESS_APP_KEY', 'ALIEXPRESS_APP_SECRET');
    const amazon = configured('AMAZON_ACCESS_KEY', 'AMAZON_SECRET_KEY');

    return res.json({
      success: true,
      connectors: [
        {
          id: 'cj-dropshipping',
          name: 'CJ Dropshipping · REST + MCP Oficial',
          platform: 'CJ Dropshipping',
          status: cjRest ? 'IMPLEMENTED' : 'REQUIRES_CREDENTIALS',
          statusReason: cjRest
            ? `REST CJ configurado${cjMcp ? ' y puente MCP oficial disponible en Shadow.' : '. MCP oficial todavía no detectado.'}`
            : 'Falta CJ_API_KEY. El conector permanece cerrado hasta tener credenciales reales.',
          capabilities: ['search', 'price_check', 'stock_check', 'tracking_sync', 'manual_purchase'],
          apiKeyConfigured: cjRest,
          endpointUrl: 'https://developers.cjdropshipping.com',
          defaultCurrency: 'USD',
          rateLimitPerMinute: 60,
          lastCheckedAt: now,
        },
        {
          id: 'aliexpress-direct',
          name: 'AliExpress Open Platform API (DS)',
          platform: 'AliExpress Direct',
          status: aliExpress ? 'IMPLEMENTED' : 'NOT_CONFIGURED',
          statusReason: aliExpress
            ? 'Credenciales DS detectadas. Las operaciones de compra permanecen fuera del modo autónomo.'
            : 'AliExpress DS todavía no tiene App Key/App Secret configurados.',
          capabilities: ['search', 'direct_url', 'price_check', 'stock_check', 'manual_purchase'],
          apiKeyConfigured: aliExpress,
          endpointUrl: 'https://ds.aliexpress.com/dropshipping-api',
          defaultCurrency: 'USD',
          rateLimitPerMinute: 60,
          lastCheckedAt: now,
        },
        {
          id: 'amazon-global',
          name: 'Amazon Product Advertising / SP-API',
          platform: 'Amazon Global',
          status: amazon ? 'REQUIRES_HUMAN_ACTION' : 'REQUIRES_CREDENTIALS',
          statusReason: amazon
            ? 'Credenciales detectadas. Cualquier compra final requiere un flujo gobernado y acción humana.'
            : 'Credenciales de Amazon no configuradas.',
          capabilities: ['search', 'direct_url', 'price_check', 'stock_check', 'manual_purchase'],
          apiKeyConfigured: amazon,
          defaultCurrency: 'USD',
          rateLimitPerMinute: 60,
          lastCheckedAt: now,
        },
        {
          id: 'alibaba-wholesale',
          name: 'Alibaba B2B Wholesale / RFQ',
          platform: 'Alibaba Wholesale',
          status: 'REQUIRES_HUMAN_ACTION',
          statusReason: 'Las operaciones mayoristas, RFQ y Trade Assurance requieren revisión humana antes de comprometer una compra.',
          capabilities: ['search', 'direct_url', 'price_check', 'manual_purchase'],
          apiKeyConfigured: false,
          defaultCurrency: 'USD',
          rateLimitPerMinute: 30,
          lastCheckedAt: now,
        },
        {
          id: 'direct-import',
          name: 'Importador URL Gobernado',
          platform: 'Direct Import',
          status: 'REQUIRES_HUMAN_ACTION',
          statusReason: 'La extracción generativa heredada está deshabilitada para evitar inventar precio, stock, proveedor o imágenes. Se migrará a evidencia verificable.',
          capabilities: ['direct_url', 'manual_purchase'],
          apiKeyConfigured: true,
          defaultCurrency: 'USD',
          rateLimitPerMinute: 30,
          lastCheckedAt: now,
        },
      ],
    });
  });

  router.post('/direct-import', (_req, res) => {
    return res.status(410).json({
      error: 'LEGACY_DIRECT_IMPORT_DISABLED',
      message: 'La extracción URL heredada podía inferir hechos comerciales sin evidencia. Use sourcing gobernado o un conector oficial.',
      governedAlternativeRequired: true,
    });
  });

  return router;
}
