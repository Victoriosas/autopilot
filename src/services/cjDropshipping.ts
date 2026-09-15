const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

export class CJRequestError extends Error {
  constructor(public status: number, public retryAfterMs = 0) { super(`CJ_HTTP_${status}`); }
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

export interface CJInventoryWarehouse {
  countryCode: string;
  totalInventory: number | null;
  cjInventory: number | null;
  factoryInventory: number | null;
  verifiedWarehouse?: number | null;
}

export interface CJVariant {
  vid: string;
  pid: string;
  variantNameEn: string;
  variantSku: string;
  variantImage: string;
  variantWeight: number | null;
  variantSellPrice: number | null;
  variantSugSellPrice: number | null;
  // Legacy aliases kept for older consumers.
  skuId?: string;
  skuName?: string;
  skuImage?: string;
  salePrice?: number;
  stockQuantity?: number;
}

export interface CJProduct {
  pid: string;
  productNameEn: string;
  productName: string;
  productImage: string;
  productSku: string;
  productWeight: string;
  productType: string;
  salePrice: number;
  sellPrice: number;
  categoryName: string;
  categoryId: string;
  stockQuantity?: number;
  supplierId: string;
  supplierName: string;
  isFreeShipping: boolean;
  shippingCountryCodes: string;
  createTime: number;
  productUrl?: string;
  variants?: CJVariant[];
  description?: string;
  listedNum?: number;
  status?: string;
  totalVerifiedInventory?: number;
  verifiedWarehouse?: number;
  deliveryCycle?: string;
}

export interface CJFreightOption {
  logisticName: string;
  logisticAging: string;
  logisticPrice: number;
  taxesFee: number;
  clearanceOperationFee: number;
  totalPostageFee: number | null;
  totalCostUsd: number;
}

export interface CJVariantStock {
  variantId: string;
  totalInventory: number | null;
  warehouses: CJInventoryWarehouse[];
}

export interface CJSearchResult {
  code: number;
  message: string;
  data: {
    list: CJProduct[];
    total: number;
    pageNum: number;
    pageSize: number;
  };
}

export interface CJCategory {
  id: string;
  name: string;
}

function mapVariant(item: any): CJVariant {
  const price = finiteNumber(item?.variantSellPrice);
  return {
    vid: String(item?.vid || item?.id || ''),
    pid: String(item?.pid || ''),
    variantNameEn: String(item?.variantNameEn || item?.nameEn || ''),
    variantSku: String(item?.variantSku || item?.sku || ''),
    variantImage: String(item?.variantImage || item?.img || ''),
    variantWeight: finiteNumber(item?.variantWeight ?? item?.weight) ?? null,
    variantSellPrice: price ?? null,
    variantSugSellPrice: finiteNumber(item?.variantSugSellPrice) ?? null,
    skuId: String(item?.vid || item?.id || ''),
    skuName: String(item?.variantNameEn || item?.nameEn || ''),
    skuImage: String(item?.variantImage || item?.img || ''),
    salePrice: price,
    stockQuantity: observedStock(item?.stockQuantity ?? item?.totalInventory),
  };
}

function mapProduct(item: any): CJProduct {
  const sellPrice = finiteNumber(item?.sellPrice) ?? finiteNumber(item?.salePrice) ?? 0;
  return {
    pid: String(item?.pid || item?.id || ''),
    productNameEn: String(item?.productNameEn || item?.nameEn || item?.nameen || ''),
    productName: String(item?.productName || item?.name || ''),
    productImage: String(item?.productImage || item?.bigImage || item?.bigimg || ''),
    productSku: String(item?.productSku || item?.sku || ''),
    productWeight: String(item?.productWeight ?? item?.weight ?? ''),
    productType: String(item?.productType ?? item?.producttype ?? 'ORDINARY_PRODUCT'),
    salePrice: sellPrice,
    sellPrice,
    categoryName: String(item?.categoryName || item?.category || ''),
    categoryId: String(item?.categoryId || item?.categoryid || ''),
    stockQuantity: observedStock(item?.stockQuantity ?? item?.totalVerifiedInventory),
    supplierId: String(item?.supplierId || ''),
    supplierName: String(item?.supplierName || ''),
    isFreeShipping: item?.isFreeShipping === true || item?.addMarkStatus === 1,
    shippingCountryCodes: String(item?.shippingCountryCodes || ''),
    createTime: Number(item?.createTime || item?.createAt || item?.createdate || 0) || 0,
    productUrl: item?.pid ? `https://cjdropshipping.com/product-p-${item.pid}.html` : undefined,
    variants: Array.isArray(item?.variants) ? item.variants.map(mapVariant).filter((v: CJVariant) => Boolean(v.vid)) : undefined,
    description: typeof item?.description === 'string' ? item.description : undefined,
    listedNum: observedStock(item?.listedNum ?? item?.listed),
    status: item?.status === undefined ? (item?.saleStatus === undefined ? undefined : String(item.saleStatus)) : String(item.status),
    totalVerifiedInventory: observedStock(item?.totalVerifiedInventory),
    verifiedWarehouse: observedStock(item?.verifiedWarehouse),
    deliveryCycle: typeof item?.deliveryCycle === 'string' ? item.deliveryCycle : undefined,
  };
}

class CJDropshippingClient {
  private apiKey: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry = 0;
  private refreshExpiry = 0;
  private tokenPromise: Promise<string> | null = null;
  private requestQueue: Promise<void> = Promise.resolve();
  private nextRequestAt = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  // CJ documents a 1 QPS limit. Serialize calls within each warm serverless
  // instance so concurrent product/stock/freight work cannot burst the API.
  private async rateLimit(): Promise<void> {
    const slot = this.requestQueue.then(async () => {
      const waitMs = Math.max(0, this.nextRequestAt - Date.now());
      if (waitMs > 0) await new Promise((resolve) => setTimeout(resolve, waitMs));
      this.nextRequestAt = Date.now() + 1100;
    });
    this.requestQueue = slot.catch(() => undefined);
    await slot;
  }

  private async ensureAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) return this.accessToken;
    if (this.tokenPromise) return this.tokenPromise;

    this.tokenPromise = (async () => {
      if (this.refreshToken && Date.now() < this.refreshExpiry) return this.refreshAccessToken();
      return this.getNewAccessToken();
    })().finally(() => {
      this.tokenPromise = null;
    });

    return this.tokenPromise;
  }

  private async getNewAccessToken(): Promise<string> {
    await this.rateLimit();
    const response = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (data.code !== 200 || !data.data) throw new CJRequestError(response.ok ? 401 : response.status);
    this.accessToken = data.data.accessToken;
    this.refreshToken = data.data.refreshToken || null;
    this.tokenExpiry = new Date(data.data.accessTokenExpiryDate).getTime() - 60000;
    this.refreshExpiry = data.data.refreshTokenExpiryDate ? new Date(data.data.refreshTokenExpiryDate).getTime() - 60000 : 0;
    console.log('[CJ] Access token obtained');
    return this.accessToken!;
  }

  private async refreshAccessToken(): Promise<string> {
    await this.rateLimit();
    const response = await fetch(`${CJ_BASE_URL}/authentication/refreshAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
      signal: AbortSignal.timeout(8000),
    });
    const data = await response.json();
    if (data.code !== 200 || !data.data) return this.getNewAccessToken();
    this.accessToken = data.data.accessToken;
    this.refreshToken = data.data.refreshToken || this.refreshToken;
    this.tokenExpiry = new Date(data.data.accessTokenExpiryDate).getTime() - 60000;
    this.refreshExpiry = data.data.refreshTokenExpiryDate ? new Date(data.data.refreshTokenExpiryDate).getTime() - 60000 : this.refreshExpiry;
    console.log('[CJ] Token refreshed');
    return this.accessToken!;
  }

  private async request(method: string, path: string, body?: any, retries = 1): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const token = await this.ensureAccessToken();
        await this.rateLimit();
        const headers: Record<string, string> = { 'CJ-Access-Token': token, 'Content-Type': 'application/json' };
        const options: RequestInit = { method, headers, signal: AbortSignal.timeout(8000) };
        if (body && (method === 'POST' || method === 'PUT')) options.body = JSON.stringify(body);
        const response = await fetch(`${CJ_BASE_URL}${path}`, options);
        if (response.status === 429) {
          const retry = response.headers.get('retry-after');
          const delay = retry && /^\d+$/.test(retry) ? Number(retry) * 1000 : retry ? Date.parse(retry) - Date.now() : 10000;
          throw new CJRequestError(429, Number.isFinite(delay) ? Math.max(1000, delay) : 10000);
        }
        if (!response.ok) throw new CJRequestError(response.status);
        const data = await response.json();
        if (data.code !== 200 && data.code !== 0) throw new CJRequestError(400);
        return data;
      } catch (error: any) {
        if (attempt === retries) throw error;
        if (error instanceof CJRequestError && error.status === 429) {
          await new Promise((resolve) => setTimeout(resolve, error.retryAfterMs || attempt * 2000));
          continue;
        }
        throw error;
      }
    }
  }

  async searchProducts(params: {
    keyword?: string;
    categoryId?: string;
    pageNum?: number;
    pageSize?: number;
    sort?: string;
    minPrice?: number;
    maxPrice?: number;
  }): Promise<{ products: CJProduct[]; total: number }> {
    const searchParams = new URLSearchParams();
    searchParams.set('pageNum', String(params.pageNum || 1));
    searchParams.set('pageSize', String(params.pageSize || 20));
    if (params.keyword) searchParams.set('productNameEn', params.keyword);
    if (params.categoryId) searchParams.set('categoryId', params.categoryId);
    if (params.minPrice !== undefined) searchParams.set('minPrice', String(params.minPrice));
    if (params.maxPrice !== undefined) searchParams.set('maxPrice', String(params.maxPrice));
    if (params.sort) searchParams.set('sort', params.sort);
    const result = await this.request('GET', `/product/list?${searchParams.toString()}`);
    const list = result.data?.list || [];
    return { products: list.map(mapProduct), total: Number(result.data?.total || 0) };
  }

  async getProductDetail(productId: string): Promise<CJProduct | null> {
    try {
      const result = await this.request('GET', `/product/query?pid=${encodeURIComponent(productId)}`);
      const item = result.data || result.result;
      return item ? mapProduct(item) : null;
    } catch {
      return null;
    }
  }

  async getVariants(productId: string): Promise<CJVariant[]> {
    try {
      const result = await this.request('GET', `/product/variant/query?pid=${encodeURIComponent(productId)}`);
      return Array.isArray(result.data) ? result.data.map(mapVariant).filter((variant: CJVariant) => Boolean(variant.vid)) : [];
    } catch {
      return [];
    }
  }

  async getVariantStock(variantId: string): Promise<CJVariantStock | null> {
    try {
      const result = await this.request('GET', `/product/stock/queryByVid?vid=${encodeURIComponent(variantId)}`);
      const rows = Array.isArray(result.data) ? result.data : [];
      const warehouses: CJInventoryWarehouse[] = rows.map((row: any) => ({
        countryCode: String(row?.countryCode || ''),
        totalInventory: observedStock(row?.totalInventoryNum) ?? null,
        cjInventory: observedStock(row?.cjInventoryNum) ?? null,
        factoryInventory: observedStock(row?.factoryInventoryNum) ?? null,
        verifiedWarehouse: observedStock(row?.verifiedWarehouse) ?? null,
      }));
      const knownTotals = warehouses.map((warehouse) => warehouse.totalInventory).filter((value): value is number => value !== null);
      return { variantId, totalInventory: knownTotals.length ? knownTotals.reduce((sum, value) => sum + value, 0) : null, warehouses };
    } catch {
      return null;
    }
  }

  async calculateShipping(params: {
    variantId: string;
    countryCode: string;
    quantity?: number;
    startCountryCode?: string;
  }): Promise<CJFreightOption[]> {
    try {
      const result = await this.request('POST', '/logistic/freightCalculate', {
        startCountryCode: params.startCountryCode || 'CN',
        endCountryCode: params.countryCode,
        products: [{ quantity: Math.max(1, Math.floor(params.quantity || 1)), vid: params.variantId }],
      });
      const options = Array.isArray(result.data) ? result.data : [];
      return options.flatMap((option: any) => {
        const logisticPrice = finiteNumber(option?.logisticPrice);
        if (logisticPrice === undefined || logisticPrice < 0) return [];
        const taxesFee = Math.max(0, finiteNumber(option?.taxesFee) ?? 0);
        const clearanceOperationFee = Math.max(0, finiteNumber(option?.clearanceOperationFee) ?? 0);
        const totalPostageFee = finiteNumber(option?.totalPostageFee);
        const totalCostUsd = totalPostageFee !== undefined && totalPostageFee >= 0
          ? totalPostageFee
          : logisticPrice + taxesFee + clearanceOperationFee;
        return [{
          logisticName: String(option?.logisticName || ''),
          logisticAging: String(option?.logisticAging || ''),
          logisticPrice,
          taxesFee,
          clearanceOperationFee,
          totalPostageFee: totalPostageFee ?? null,
          totalCostUsd,
        }];
      });
    } catch {
      return [];
    }
  }

  async getCategoryList(): Promise<CJCategory[]> {
    try {
      const result = await this.request('GET', '/product/category/list');
      return result.data || result.result || [];
    } catch {
      return [];
    }
  }
}

let cjClient: CJDropshippingClient | null = null;

export function getCJClient(): CJDropshippingClient | null {
  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) return null;
  if (!cjClient) cjClient = new CJDropshippingClient(apiKey);
  return cjClient;
}

export default CJDropshippingClient;
