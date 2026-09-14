const CJ_BASE_URL = 'https://developers.cjdropshipping.com/api2.0/v1';

export class CJRequestError extends Error {
  constructor(public status: number, public retryAfterMs = 0) { super(`CJ_HTTP_${status}`); }
}

function observedStock(value: unknown): number | undefined {
  if (typeof value !== 'number' && typeof value !== 'string') return undefined;
  if (typeof value === 'string' && !value.trim()) return undefined;
  const stock = Number(value);
  return Number.isSafeInteger(stock) && stock >= 0 ? stock : undefined;
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
}

export interface CJVariant {
  skuId: string;
  skuName: string;
  skuImage: string;
  salePrice: number;
  stockQuantity: number;
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

class CJDropshippingClient {
  private apiKey: string;
  private accessToken: string | null = null;
  private refreshToken: string | null = null;
  private tokenExpiry: number = 0;
  private refreshExpiry: number = 0;
  private lastRequestTime: number = 0;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async rateLimit(): Promise<void> {
    const now = Date.now();
    const elapsed = now - this.lastRequestTime;
    if (elapsed < 1100) {
      await new Promise((r) => setTimeout(r, 1100 - elapsed));
    }
    this.lastRequestTime = Date.now();
  }

  private async ensureAccessToken(): Promise<string> {
    if (this.accessToken && Date.now() < this.tokenExpiry) {
      return this.accessToken;
    }

    if (this.refreshToken && Date.now() < this.refreshExpiry) {
      return await this.refreshAccessToken();
    }

    return await this.getNewAccessToken();
  }

  private async getNewAccessToken(): Promise<string> {
    const response = await fetch(`${CJ_BASE_URL}/authentication/getAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ apiKey: this.apiKey }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json();

    if (data.code !== 200 || !data.data) {
      throw new CJRequestError(response.ok ? 401 : response.status);
    }

    this.accessToken = data.data.accessToken;
    this.refreshToken = data.data.refreshToken;
    this.tokenExpiry = new Date(data.data.accessTokenExpiryDate).getTime() - 60000;
    this.refreshExpiry = new Date(data.data.refreshTokenExpiryDate).getTime() - 60000;

    console.log('[CJ] Access token obtained');
    return this.accessToken!;
  }

  private async refreshAccessToken(): Promise<string> {
    const response = await fetch(`${CJ_BASE_URL}/authentication/refreshAccessToken`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken: this.refreshToken }),
      signal: AbortSignal.timeout(8000),
    });

    const data = await response.json();

    if (data.code !== 200 || !data.data) {
      return await this.getNewAccessToken();
    }

    this.accessToken = data.data.accessToken;
    this.refreshToken = data.data.refreshToken;
    this.tokenExpiry = new Date(data.data.accessTokenExpiryDate).getTime() - 60000;
    this.refreshExpiry = new Date(data.data.refreshTokenExpiryDate).getTime() - 60000;

    console.log('[CJ] Token refreshed');
    return this.accessToken!;
  }

  private async request(method: string, path: string, body?: any, retries: number = 1): Promise<any> {
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        await this.rateLimit();
        const token = await this.ensureAccessToken();
        const url = `${CJ_BASE_URL}${path}`;

        const headers: Record<string, string> = {
          'CJ-Access-Token': token,
          'Content-Type': 'application/json',
        };

        const options: RequestInit = { method, headers, signal: AbortSignal.timeout(8000) };
        if (body && (method === 'POST' || method === 'PUT')) {
          options.body = JSON.stringify(body);
        }

        const response = await fetch(url, options);

        if (response.status === 429) {
          const retry = response.headers.get('retry-after');
          const delay = retry && /^\d+$/.test(retry) ? Number(retry)*1000 : retry ? Date.parse(retry)-Date.now() : 10000;
          throw new CJRequestError(429,Number.isFinite(delay)?Math.max(1000,delay):10000);
        }

        if (!response.ok) {
          throw new CJRequestError(response.status);
        }

        const data = await response.json();

        if (data.code !== 200 && data.code !== 0) {
          throw new CJRequestError(400);
        }

        return data;
      } catch (err: any) {
        if (attempt === retries) throw err;
        if (err.message?.includes('429')) {
          await new Promise((r) => setTimeout(r, attempt * 2000));
          continue;
        }
        throw err;
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
    if (params.minPrice) searchParams.set('minPrice', String(params.minPrice));
    if (params.maxPrice) searchParams.set('maxPrice', String(params.maxPrice));
    if (params.sort) searchParams.set('sort', params.sort);

    const result = await this.request('GET', `/product/list?${searchParams.toString()}`);

    const list = result.data?.list || [];
    const products: CJProduct[] = list.map((item: any) => ({
      pid: item.pid,
      productNameEn: item.productNameEn || '',
      productName: item.productName || '',
      productImage: item.productImage || '',
      productSku: item.productSku || '',
      productWeight: item.productWeight || '0',
      productType: item.productType || 'ORDINARY_PRODUCT',
      salePrice: parseFloat(item.sellPrice) || parseFloat(item.salePrice) || 0,
      sellPrice: parseFloat(item.sellPrice) || 0,
      categoryName: item.categoryName || '',
      categoryId: item.categoryId || '',
      stockQuantity: observedStock(item.stockQuantity),
      supplierId: item.supplierId || '',
      supplierName: item.supplierName || '',
      isFreeShipping: item.isFreeShipping || false,
      shippingCountryCodes: item.shippingCountryCodes || '',
      createTime: item.createTime || 0,
      productUrl: `https://cjdropshipping.com/product-p-${item.pid}.html`,
    }));

    return {
      products,
      total: result.data?.total || 0,
    };
  }

  async getProductDetail(productId: string): Promise<CJProduct | null> {
    try {
      const result = await this.request('GET', `/product/query?pid=${productId}`);
      const item = result.data || result.result;
      if (!item) return null;

      return {
        pid: item.pid,
        productNameEn: item.productNameEn || '',
        productName: item.productName || '',
        productImage: item.productImage || '',
        productSku: item.productSku || '',
        productWeight: item.productWeight || '0',
        productType: item.productType || 'ORDINARY_PRODUCT',
        salePrice: parseFloat(item.sellPrice) || parseFloat(item.salePrice) || 0,
        sellPrice: parseFloat(item.sellPrice) || 0,
        categoryName: item.categoryName || '',
        categoryId: item.categoryId || '',
        stockQuantity: observedStock(item.stockQuantity),
        supplierId: item.supplierId || '',
        supplierName: item.supplierName || '',
        isFreeShipping: item.isFreeShipping || false,
        shippingCountryCodes: item.shippingCountryCodes || '',
        createTime: item.createTime || 0,
        productUrl: `https://cjdropshipping.com/product-p-${item.pid}.html`,
      };
    } catch {
      return null;
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

  async calculateShipping(params: {
    productId: string;
    countryCode: string;
    quantity?: number;
  }): Promise<any> {
    try {
      const result = await this.request('POST', '/logistic/freightCalculate', {
        startCountryCode: 'CN',
        endCountryCode: params.countryCode,
        productId: params.productId,
        productQuantity: params.quantity || 1,
        productWeight: 0.5,
      });
      return result.data || result.result || null;
    } catch {
      return null;
    }
  }
}

let cjClient: CJDropshippingClient | null = null;

export function getCJClient(): CJDropshippingClient | null {
  const apiKey = process.env.CJ_API_KEY;
  if (!apiKey) return null;
  if (!cjClient) {
    cjClient = new CJDropshippingClient(apiKey);
  }
  return cjClient;
}

export default CJDropshippingClient;
