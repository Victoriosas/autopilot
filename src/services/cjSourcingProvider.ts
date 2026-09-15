import CJDropshippingClient, {
  getCJClient,
  type CJFreightOption,
  type CJProduct,
  type CJVariant,
  type CJVariantStock,
} from './cjDropshipping';
import {
  CJMcpError,
  cjMcpShadowSafetyReady,
  getCJMcpReadOnlyClient,
  type CJMcpReadOnlyClient,
} from './cjMcp';
import type { SourcingConfig } from '../autopilot/sourcingEvidence';

export interface CJSourcingReadProvider {
  searchProducts(params: { keyword?: string; pageNum?: number; pageSize?: number }): Promise<{ products: CJProduct[]; total: number }>;
  getVariants(productId: string): Promise<CJVariant[]>;
  getVariantStock(variantId: string): Promise<CJVariantStock | null>;
  calculateShipping(params: { variantId: string; countryCode: string; quantity?: number; startCountryCode?: string }): Promise<CJFreightOption[]>;
  drainTrace(): string[];
}

export class CJReadChainError extends Error {
  constructor(public code: string, public status?: number) {
    super(code);
  }
}

function finiteNumber(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const number = Number(value);
  return Number.isFinite(number) ? number : undefined;
}

function observedStock(value: unknown): number | undefined {
  const stock = finiteNumber(value);
  return stock !== undefined && Number.isSafeInteger(stock) && stock >= 0 ? stock : undefined;
}

function firstString(...values: unknown[]): string {
  for (const value of values) if (typeof value === 'string' && value.trim()) return value.trim();
  return '';
}

function mapMcpProduct(item: any): CJProduct {
  const sellPrice = finiteNumber(item?.sellPrice ?? item?.salePrice ?? item?.price) ?? 0;
  return {
    pid: firstString(item?.pid, item?.id, item?.productId),
    productNameEn: firstString(item?.productNameEn, item?.nameEn, item?.productName, item?.name),
    productName: firstString(item?.productName, item?.name, item?.productNameEn, item?.nameEn),
    productImage: firstString(item?.productImage, item?.bigImage, item?.bigimg, item?.image),
    productSku: firstString(item?.productSku, item?.sku, item?.spu),
    productWeight: String(item?.productWeight ?? item?.weight ?? ''),
    productType: firstString(item?.productType, item?.producttype) || 'ORDINARY_PRODUCT',
    salePrice: sellPrice,
    sellPrice,
    categoryName: firstString(item?.categoryName, item?.category, item?.categoryEn),
    categoryId: firstString(item?.categoryId, item?.categoryid),
    stockQuantity: observedStock(item?.stockQuantity ?? item?.warehouseInventory ?? item?.totalVerifiedInventory),
    supplierId: firstString(item?.supplierId, item?.supplier?.id),
    supplierName: firstString(item?.supplierName, item?.supplier?.name),
    isFreeShipping: item?.isFreeShipping === true || Number(item?.addMarkStatus) === 1,
    shippingCountryCodes: Array.isArray(item?.shippingCountryCodes)
      ? item.shippingCountryCodes.join(',')
      : String(item?.shippingCountryCodes || ''),
    createTime: Number(item?.createTime ?? item?.createAt ?? item?.createdate ?? 0) || 0,
    productUrl: firstString(item?.productUrl) || undefined,
    description: typeof item?.description === 'string' ? item.description : undefined,
    listedNum: observedStock(item?.listedNum ?? item?.listed),
    status: item?.status === undefined ? (item?.saleStatus === undefined ? undefined : String(item.saleStatus)) : String(item.status),
    totalVerifiedInventory: observedStock(item?.totalVerifiedInventory),
    verifiedWarehouse: observedStock(item?.verifiedWarehouse),
    deliveryCycle: typeof item?.deliveryCycle === 'string' ? item.deliveryCycle : undefined,
  };
}

function mapMcpVariant(item: any, fallbackPid = ''): CJVariant {
  const price = finiteNumber(item?.variantSellPrice ?? item?.sellPrice ?? item?.salePrice ?? item?.price);
  return {
    vid: firstString(item?.vid, item?.variantId, item?.id),
    pid: firstString(item?.pid, item?.productId) || fallbackPid,
    variantNameEn: firstString(item?.variantNameEn, item?.variantName, item?.nameEn, item?.name),
    variantSku: firstString(item?.variantSku, item?.sku),
    variantImage: firstString(item?.variantImage, item?.bigImage, item?.image),
    variantWeight: finiteNumber(item?.variantWeight ?? item?.weight) ?? null,
    variantSellPrice: price ?? null,
    variantSugSellPrice: finiteNumber(item?.variantSugSellPrice ?? item?.suggestedPrice) ?? null,
    skuId: firstString(item?.vid, item?.variantId, item?.id),
    skuName: firstString(item?.variantNameEn, item?.variantName, item?.nameEn, item?.name),
    skuImage: firstString(item?.variantImage, item?.bigImage, item?.image),
    salePrice: price,
    stockQuantity: observedStock(item?.stockQuantity ?? item?.totalInventory ?? item?.totalInventoryNum),
  };
}

function rowsFrom(value: any): any[] {
  if (Array.isArray(value)) return value;
  for (const key of ['list', 'records', 'content', 'data', 'inventories']) {
    if (Array.isArray(value?.[key])) return value[key];
  }
  return [];
}

function mapMcpStock(variantId: string, value: any): CJVariantStock | null {
  const rows = rowsFrom(value);
  if (!rows.length) return null;
  const warehouses = rows.map((row: any) => ({
    countryCode: firstString(row?.countryCode, row?.country, row?.areaCode),
    totalInventory: observedStock(row?.totalInventoryNum ?? row?.totalInventory ?? row?.inventory) ?? null,
    cjInventory: observedStock(row?.cjInventoryNum ?? row?.cjInventory) ?? null,
    factoryInventory: observedStock(row?.factoryInventoryNum ?? row?.factoryInventory) ?? null,
    verifiedWarehouse: observedStock(row?.verifiedWarehouse) ?? null,
  }));
  const knownTotals = warehouses.map((warehouse) => warehouse.totalInventory).filter((value): value is number => value !== null);
  return {
    variantId,
    totalInventory: knownTotals.length ? knownTotals.reduce((sum, value) => sum + value, 0) : null,
    warehouses,
  };
}

function mapMcpFreight(value: any): CJFreightOption[] {
  return rowsFrom(value).flatMap((option: any) => {
    const logisticPrice = finiteNumber(option?.logisticPrice ?? option?.freight);
    const totalPostageFee = finiteNumber(option?.totalPostageFee ?? option?.totalFee);
    if ((logisticPrice === undefined || logisticPrice < 0) && (totalPostageFee === undefined || totalPostageFee < 0)) return [];
    const taxesFee = Math.max(0, finiteNumber(option?.taxesFee) ?? 0);
    const clearanceOperationFee = Math.max(0, finiteNumber(option?.clearanceOperationFee) ?? 0);
    const base = logisticPrice ?? 0;
    const totalCostUsd = totalPostageFee !== undefined && totalPostageFee >= 0
      ? totalPostageFee
      : base + taxesFee + clearanceOperationFee;
    return [{
      logisticName: firstString(option?.logisticName, option?.logisticsName, option?.name),
      logisticAging: firstString(option?.logisticAging, option?.aging, option?.deliveryTime),
      logisticPrice: base,
      taxesFee,
      clearanceOperationFee,
      totalPostageFee: totalPostageFee ?? null,
      totalCostUsd,
    }];
  });
}

function searchRows(value: any): any[] {
  if (Array.isArray(value?.content)) {
    return value.content.flatMap((group: any) => Array.isArray(group?.productList) ? group.productList : []);
  }
  return rowsFrom(value);
}

function errorCode(error: unknown): string {
  if (error instanceof CJMcpError || error instanceof CJReadChainError) return error.code.replace(/[^A-Z0-9_:-]/gi, '_').slice(0, 120);
  const status = Number((error as any)?.status);
  if (Number.isFinite(status) && status > 0) return `CJ_REST_HTTP_${status}`;
  return 'UNKNOWN';
}

function errorStatus(error: unknown): number | undefined {
  const status = Number((error as any)?.status);
  return Number.isFinite(status) && status > 0 ? status : undefined;
}

export class CJMcpFirstSourcingProvider implements CJSourcingReadProvider {
  private trace: string[] = [];

  constructor(
    private readonly mcp: CJMcpReadOnlyClient | null,
    private readonly rest: CJDropshippingClient | null,
    private readonly initialMcpFailure: string | null = null,
  ) {}

  private note(value: string) {
    if (!this.trace.includes(value)) this.trace.push(value);
  }

  private async withFallback<T>(tool: string, mcpCall: () => Promise<T>, restCall: () => Promise<T>): Promise<T> {
    let mcpFailure: string | null = this.initialMcpFailure;
    if (this.mcp) {
      try {
        const value = await mcpCall();
        this.note(`CJ_MCP_${tool.toUpperCase()}_OBSERVED`);
        return value;
      } catch (error) {
        mcpFailure = errorCode(error);
        this.note(`CJ_MCP_${tool.toUpperCase()}_FALLBACK_${mcpFailure}`);
        if (!this.rest) throw new CJReadChainError(`CJ_MCP_ONLY_${mcpFailure}`, errorStatus(error));
      }
    } else if (mcpFailure) {
      this.note(`CJ_MCP_${tool.toUpperCase()}_CONFIG_FALLBACK_${mcpFailure}`);
    }
    if (!this.rest) {
      throw new CJReadChainError(mcpFailure ? `CJ_MCP_CONFIG_${mcpFailure}` : 'CJ_READ_PROVIDER_NOT_CONFIGURED');
    }
    try {
      const value = await restCall();
      this.note(`CJ_REST_${tool.toUpperCase()}_OBSERVED`);
      return value;
    } catch (error) {
      const restFailure = errorCode(error);
      const chain = mcpFailure
        ? `CJ_MCP_FALLBACK_${mcpFailure}_${restFailure}`
        : `CJ_REST_ONLY_${restFailure}`;
      throw new CJReadChainError(chain, errorStatus(error));
    }
  }

  async searchProducts(params: { keyword?: string; pageNum?: number; pageSize?: number }) {
    return this.withFallback('search_products', async () => {
      const data: any = await this.mcp!.callReadOnlyJsonTool('search_products', {
        keyword: params.keyword,
        pageNum: params.pageNum || 1,
        pageSize: params.pageSize || 20,
        startWarehouseInventory: 1,
        features: ['enable_description', 'enable_category'],
      });
      const raw = searchRows(data);
      const products = raw.map(mapMcpProduct).filter((product) => Boolean(product.pid));
      const total = Number(data?.totalRecords ?? data?.total ?? products.length);
      if (!products.length && Number.isFinite(total) && total > 0) throw new CJMcpError('CJ_MCP_SEARCH_SCHEMA_MISMATCH', 'CJ_MCP_SEARCH_SCHEMA_MISMATCH');
      return { products, total: Number.isFinite(total) ? total : products.length };
    }, async () => this.rest!.searchProducts(params));
  }

  async getVariants(productId: string) {
    return this.withFallback('get_product_variants', async () => {
      const data = await this.mcp!.callReadOnlyJsonTool('get_product_variants', { pid: productId });
      const variants = rowsFrom(data).map((row) => mapMcpVariant(row, productId)).filter((variant) => Boolean(variant.vid));
      if (!variants.length) throw new CJMcpError('CJ_MCP_VARIANTS_EMPTY', 'CJ_MCP_VARIANTS_EMPTY');
      return variants;
    }, async () => this.rest!.getVariants(productId));
  }

  async getVariantStock(variantId: string) {
    return this.withFallback('query_cj_inventory', async () => {
      const data = await this.mcp!.callReadOnlyJsonTool('query_cj_inventory', { vid: variantId });
      const stock = mapMcpStock(variantId, data);
      if (!stock) throw new CJMcpError('CJ_MCP_INVENTORY_EMPTY', 'CJ_MCP_INVENTORY_EMPTY');
      return stock;
    }, async () => this.rest!.getVariantStock(variantId));
  }

  async calculateShipping(params: { variantId: string; countryCode: string; quantity?: number; startCountryCode?: string }) {
    return this.withFallback('calculate_freight', async () => {
      const data = await this.mcp!.callReadOnlyJsonTool('calculate_freight', {
        startCountryCode: params.startCountryCode || 'CN',
        endCountryCode: params.countryCode,
        products: [{ quantity: Math.max(1, Math.floor(params.quantity || 1)), vid: params.variantId }],
      });
      const freight = mapMcpFreight(data);
      if (!freight.length) throw new CJMcpError('CJ_MCP_FREIGHT_EMPTY', 'CJ_MCP_FREIGHT_EMPTY');
      return freight;
    }, async () => this.rest!.calculateShipping(params));
  }

  drainTrace(): string[] {
    const notes = [...this.trace];
    this.trace = [];
    return notes;
  }
}

function safeMcpClient(config: Pick<SourcingConfig, 'mode'>, env: NodeJS.ProcessEnv): { client: CJMcpReadOnlyClient | null; failure: string | null } {
  if (config.mode !== 'shadow' || !cjMcpShadowSafetyReady(env)) return { client: null, failure: null };
  try {
    return { client: getCJMcpReadOnlyClient(env), failure: null };
  } catch (error) {
    return { client: null, failure: errorCode(error) };
  }
}

export function cjSourcingReadConfigured(config: Pick<SourcingConfig, 'mode'>, env: NodeJS.ProcessEnv = process.env): boolean {
  const mcp = safeMcpClient(config, env);
  return Boolean(mcp.client) || Boolean(env.CJ_API_KEY?.trim());
}

export function getCJSourcingReadProvider(config: Pick<SourcingConfig, 'mode'>, env: NodeJS.ProcessEnv = process.env): CJSourcingReadProvider | null {
  const mcp = safeMcpClient(config, env);
  const rest = getCJClient();
  if (!mcp.client && !rest && !mcp.failure) return null;
  const transport = mcp.client
    ? (rest ? 'mcp-first-rest-fallback' : 'mcp-only')
    : (mcp.failure ? 'mcp-config-fallback-rest' : 'rest-only');
  const mcpState = mcp.failure ? ` invalid=${mcp.failure}` : '';
  console.info(`[CJ Sourcing] transport=${transport}${mcpState}`);
  return new CJMcpFirstSourcingProvider(mcp.client, rest, mcp.failure);
}
