import type { SourceConnectorConfig, SourceProduct, PrePurchaseVerificationResult } from '../../types';
import type { 
  SourceConnector, 
  ConnectorSearchOptions, 
  ConnectorVerificationOptions,
  ConnectorPurchasePayload,
  ConnectorPurchaseResponse 
} from './types';
import { SupplierHubConnector } from './SupplierHubConnector';
import { AmazonConnector } from './AmazonConnector';
import { AliExpressConnector } from './AliExpressConnector';
import { AlibabaConnector } from './AlibabaConnector';
import { DirectUrlConnector } from './DirectUrlConnector';

class ConnectorRegistry {
  private connectors: Map<string, SourceConnector> = new Map();

  constructor() {
    this.register(new SupplierHubConnector());
    this.register(new AmazonConnector());
    this.register(new AliExpressConnector());
    this.register(new AlibabaConnector());
    this.register(new DirectUrlConnector());
  }

  register(connector: SourceConnector) {
    this.connectors.set(connector.id, connector);
  }

  get(id: string): SourceConnector | undefined {
    return this.connectors.get(id);
  }

  getByPlatform(platform: string): SourceConnector | undefined {
    return Array.from(this.connectors.values()).find(
      c => c.platform.toLowerCase() === platform.toLowerCase() || c.id.toLowerCase() === platform.toLowerCase()
    );
  }

  getAll(): SourceConnector[] {
    return Array.from(this.connectors.values());
  }

  getConfigs(): SourceConnectorConfig[] {
    return this.getAll().map(c => ({
      id: c.id,
      name: c.name,
      platform: c.platform,
      status: c.getStatus(),
      statusReason: c.getStatusReason(),
      capabilities: c.capabilities,
      apiKeyConfigured: c.isConfigured(),
      defaultCurrency: 'EUR',
      rateLimitPerMinute: 60,
      lastCheckedAt: new Date().toISOString()
    }));
  }

  async searchAll(options: ConnectorSearchOptions): Promise<SourceProduct[]> {
    const results: SourceProduct[] = [];
    for (const connector of this.connectors.values()) {
      try {
        const found = await connector.searchProducts(options);
        results.push(...found);
      } catch (err) {
        console.warn(`Error searching on connector ${connector.name}:`, err);
      }
    }
    return results;
  }

  async verify(connectorIdOrPlatform: string, options: ConnectorVerificationOptions): Promise<PrePurchaseVerificationResult> {
    const connector = this.get(connectorIdOrPlatform) || this.getByPlatform(connectorIdOrPlatform) || this.get('supplier-hub-b2b')!;
    return connector.verifyAvailabilityAndPrice(options);
  }

  async createSupplierOrder(connectorIdOrPlatform: string, payload: ConnectorPurchasePayload): Promise<ConnectorPurchaseResponse> {
    const connector = this.get(connectorIdOrPlatform) || this.getByPlatform(connectorIdOrPlatform) || this.get('supplier-hub-b2b')!;
    return connector.createPurchaseOrder(payload);
  }
}

export const connectorRegistry = new ConnectorRegistry();
