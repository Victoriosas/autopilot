import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { getCJClient, CJProduct } from './cjDropshipping';
import { analyzeProduct, ProductAnalysis } from './productAnalyzer';
import { publishBatch } from './autoPublisher';

export interface SourcingConfig {
  scheduleInterval: number;
  isEnabled: boolean;
  categories: string[];
  minPrice: number;
  maxPrice: number;
  minRating: number;
  minMargin: number;
  autoPublishScore: number;
  maxProductsPerRun: number;
  minProductsPerCategory: number;
  maxProductsPerCategory: number;
}

export interface CategoryCount {
  category: string;
  count: number;
  needed: number;
}

export interface VerifyResult {
  verified: number;
  autoHidden: number;
  repriced: number;
  errors: number;
  details: Array<{
    productId: string;
    action: string;
    reason: string;
    oldPrice?: number;
    newPrice?: number;
  }>;
}

export interface SourcingRun {
  id: string;
  status: 'running' | 'completed' | 'failed';
  productsFound: number;
  productsPublished: number;
  productsDraft: number;
  productsRejected: number;
  apiCallsUsed: number;
  errorMessage?: string;
  startedAt: string;
  completedAt?: string;
}

export interface SourcingResult {
  runId: string;
  status: string;
  productsFound: number;
  published: number;
  draft: number;
  rejected: number;
  errors: number;
  duration: number;
}

const DEFAULT_CONFIG: SourcingConfig = {
  scheduleInterval: 86400,
  isEnabled: true,
  categories: ['Electronics', 'Home & Garden', 'Beauty & Health', 'Fashion'],
  minPrice: 5,
  maxPrice: 100,
  minRating: 4.0,
  minMargin: 30,
  autoPublishScore: 85,
  maxProductsPerRun: 50,
  minProductsPerCategory: 30,
  maxProductsPerCategory: 50,
};

const CJ_SEARCH_KEYWORDS: Record<string, string[]> = {
  'Electronics': ['bluetooth speaker', 'wireless earbuds', 'smart watch', 'phone holder', 'usb charger'],
  'Home & Garden': ['desk lamp', 'wall art', 'kitchen gadget', 'plant pot', 'candle holder'],
  'Beauty & Health': ['face cream', 'serum', 'moisturizer', 'sunscreen', 'lip balm', 'body lotion', 'hair oil', 'face wash', 'cleanser', 'anti aging'],
  'Fashion': ['sunglasses', 'wallet', 'jewelry', 'watch', 'belt'],
  'Toys & Hobbies': ['fidget toy', 'puzzle', 'board game', 'rc car', 'model kit'],
  'Sports & Entertainment': ['yoga mat', 'water bottle', 'fitness band', 'camping', 'bike light'],
  'Tools & Home Improvement': ['smart plug', 'led strip', 'storage box', 'screwdriver set', 'tape measure'],
  'Pet Supplies': ['dog toy', 'cat bed', 'pet collar', 'fish tank', 'bird cage'],
  'Baby & Kids': ['baby toy', 'kids puzzle', 'baby bottle', 'stroller', 'diaper bag'],
  'Office & Stationery': ['pen set', 'notebook', 'desk organizer', 'sticky notes', 'calculator'],
};

const CATEGORY_MAP_EN_TO_ES: Record<string, string> = {
  'Electronics': 'Tecnologia & Gadgets',
  'Home & Garden': 'Hogar & Diseno',
  'Beauty & Health': 'Belleza & Bienestar',
  'Fashion': 'Moda & Accesorios',
};

export function mapCategoryToSpanish(englishCategory: string): string {
  return CATEGORY_MAP_EN_TO_ES[englishCategory] || englishCategory;
}

class ProductSourcingService {
  private supabase: SupabaseClient | null = null;

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error('Supabase not configured');
      this.supabase = createClient(url, key);
    }
    return this.supabase;
  }

  async getConfig(): Promise<SourcingConfig> {
    const db = this.getSupabase();
    const { data } = await db.from('sourcing_config').select('*').limit(1).single();
    if (data) {
      return {
        scheduleInterval: data.schedule_interval || DEFAULT_CONFIG.scheduleInterval,
        isEnabled: data.is_enabled ?? DEFAULT_CONFIG.isEnabled,
        categories: data.categories || DEFAULT_CONFIG.categories,
        minPrice: data.min_price || DEFAULT_CONFIG.minPrice,
        maxPrice: data.max_price || DEFAULT_CONFIG.maxPrice,
        minRating: data.min_rating || DEFAULT_CONFIG.minRating,
        minMargin: data.min_margin || DEFAULT_CONFIG.minMargin,
        autoPublishScore: data.auto_publish_score || DEFAULT_CONFIG.autoPublishScore,
        maxProductsPerRun: data.max_products_per_run || DEFAULT_CONFIG.maxProductsPerRun,
        minProductsPerCategory: data.min_products_per_category || DEFAULT_CONFIG.minProductsPerCategory,
        maxProductsPerCategory: data.max_products_per_category || DEFAULT_CONFIG.maxProductsPerCategory,
      };
    }
    return DEFAULT_CONFIG;
  }

  async updateConfig(config: Partial<SourcingConfig>): Promise<void> {
    const db = this.getSupabase();
    const updateData: any = {};
    if (config.scheduleInterval !== undefined) updateData.schedule_interval = config.scheduleInterval;
    if (config.isEnabled !== undefined) updateData.is_enabled = config.isEnabled;
    if (config.categories !== undefined) updateData.categories = config.categories;
    if (config.minPrice !== undefined) updateData.min_price = config.minPrice;
    if (config.maxPrice !== undefined) updateData.max_price = config.maxPrice;
    if (config.minRating !== undefined) updateData.min_rating = config.minRating;
    if (config.minMargin !== undefined) updateData.min_margin = config.minMargin;
    if (config.autoPublishScore !== undefined) updateData.auto_publish_score = config.autoPublishScore;
    if (config.maxProductsPerRun !== undefined) updateData.max_products_per_run = config.maxProductsPerRun;
    updateData.updated_at = new Date().toISOString();

    const { data } = await db.from('sourcing_config').select('*').limit(1).single();
    if (data) {
      await db.from('sourcing_config').update(updateData).eq('id', data.id);
    } else {
      await db.from('sourcing_config').insert(updateData);
    }
  }

  async createRun(): Promise<string> {
    const db = this.getSupabase();
    const { data } = await db.from('sourcing_runs').insert({
      status: 'running',
      products_found: 0,
      products_published: 0,
      products_draft: 0,
      products_rejected: 0,
      api_calls_used: 0,
      started_at: new Date().toISOString(),
    }).select('id').single();
    return data?.id || '';
  }

  async updateRun(runId: string, update: Partial<SourcingRun>): Promise<void> {
    const db = this.getSupabase();
    const dbUpdate: any = {};
    if (update.status) dbUpdate.status = update.status;
    if (update.productsFound !== undefined) dbUpdate.products_found = update.productsFound;
    if (update.productsPublished !== undefined) dbUpdate.products_published = update.productsPublished;
    if (update.productsDraft !== undefined) dbUpdate.products_draft = update.productsDraft;
    if (update.productsRejected !== undefined) dbUpdate.products_rejected = update.productsRejected;
    if (update.apiCallsUsed !== undefined) dbUpdate.api_calls_used = update.apiCallsUsed;
    if (update.errorMessage) dbUpdate.error_message = update.errorMessage;
    if (update.completedAt) dbUpdate.completed_at = update.completedAt;

    await db.from('sourcing_runs').update(dbUpdate).eq('id', runId);
  }

  async getRuns(limit: number = 20): Promise<SourcingRun[]> {
    const db = this.getSupabase();
    const { data } = await db
      .from('sourcing_runs')
      .select('*')
      .order('started_at', { ascending: false })
      .limit(limit);
    return (data || []).map((r: any) => ({
      id: r.id,
      status: r.status,
      productsFound: r.products_found,
      productsPublished: r.products_published,
      productsDraft: r.products_draft,
      productsRejected: r.products_rejected,
      apiCallsUsed: r.api_calls_used,
      errorMessage: r.error_message,
      startedAt: r.started_at,
      completedAt: r.completed_at,
    }));
  }

  async getDiscoveredProducts(limit: number = 50): Promise<any[]> {
    const db = this.getSupabase();
    const { data } = await db
      .from('discovered_products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);
    return data || [];
  }

  async getProductsCountByCategory(): Promise<CategoryCount[]> {
    const db = this.getSupabase();
    const config = await this.getConfig();

    const { data } = await db
      .from('products')
      .select('category')
      .eq('status', 'published');

    // Map English categories to Spanish for counting
    const spanishCategories = config.categories.map((cat) => mapCategoryToSpanish(cat));

    const counts: Record<string, number> = {};
    for (const cat of config.categories) {
      counts[cat] = 0;
    }

    if (data) {
      for (const row of data) {
        const cat = row.category;
        // Check if this Spanish category matches any of our English categories
        for (const engCat of config.categories) {
          if (mapCategoryToSpanish(engCat) === cat) {
            counts[engCat]++;
            break;
          }
        }
      }
    }

    return config.categories.map((cat) => ({
      category: cat,
      count: counts[cat] || 0,
      needed: Math.max(0, config.minProductsPerCategory - (counts[cat] || 0)),
    }));
  }

  async verifyPublishedProducts(): Promise<VerifyResult> {
    const db = this.getSupabase();
    const result: VerifyResult = {
      verified: 0,
      autoHidden: 0,
      repriced: 0,
      errors: 0,
      details: [],
    };

    const { data: products, error } = await db
      .from('products')
      .select('id, title, category, price, compare_at_price, cj_product_id, stock_quantity')
      .eq('status', 'published');

    if (error || !products) {
      console.error('[Sourcing] Error fetching published products:', error);
      result.errors = 1;
      return result;
    }

    const cj = getCJClient();

    for (const product of products) {
      try {
        result.verified++;

        if (cj && product.cj_product_id) {
          const cjProduct = await cj.getProductDetail(product.cj_product_id);

          if (cjProduct) {
            const newStock = cjProduct.stockQuantity || 0;

            if (newStock === 0) {
              await db.from('products').update({ status: 'draft' }).eq('id', product.id);
              result.autoHidden++;
              result.details.push({
                productId: product.id,
                action: 'hidden',
                reason: 'out_of_stock',
              });
              continue;
            }

            const newPrice = cjProduct.salePrice || cjProduct.sellPrice;
            if (newPrice && product.price) {
              const priceDelta = Math.abs(newPrice - product.price) / product.price;
              if (priceDelta > 0.15) {
                const { suggestedPrice, compareAtPrice } = this.calculatePricing(newPrice);
                await db.from('products').update({
                  price: suggestedPrice,
                  compare_at_price: compareAtPrice,
                }).eq('id', product.id);
                result.repriced++;
                result.details.push({
                  productId: product.id,
                  action: 'repriced',
                  reason: `price_changed_${(priceDelta * 100).toFixed(0)}%`,
                  oldPrice: product.price,
                  newPrice: suggestedPrice,
                });
              }
            }
          }
        }
      } catch (err) {
        console.error(`[Sourcing] Error verifying product ${product.id}:`, err);
        result.errors++;
      }
    }

    return result;
  }

  private calculatePricing(cost: number, shipping: number = 3.5, targetMarginPct: number = 55) {
    const totalCost = cost + shipping;
    const rawPrice = totalCost / (1 - targetMarginPct / 100);

    let roundedPrice = Math.ceil(rawPrice);
    if (roundedPrice > 20) {
      roundedPrice = roundedPrice - 0.05;
    } else {
      roundedPrice = Math.round(rawPrice * 2) / 2 - 0.05;
      if (roundedPrice < 9.95) roundedPrice = 9.95;
    }

    const compareAtPrice = +(roundedPrice * 1.35).toFixed(2);
    return { suggestedPrice: roundedPrice, compareAtPrice };
  }

  async getStats(): Promise<{
    totalRuns: number;
    totalProductsFound: number;
    totalPublished: number;
    totalDraft: number;
    totalRejected: number;
    lastRunAt: string | null;
    apiCallsUsed: number;
  }> {
    const db = this.getSupabase();
    const { data } = await db
      .from('sourcing_runs')
      .select('products_found, products_published, products_draft, products_rejected, api_calls_used, started_at')
      .order('started_at', { ascending: false })
      .limit(100);

    if (!data || data.length === 0) {
      return {
        totalRuns: 0,
        totalProductsFound: 0,
        totalPublished: 0,
        totalDraft: 0,
        totalRejected: 0,
        lastRunAt: null,
        apiCallsUsed: 0,
      };
    }

    return {
      totalRuns: data.length,
      totalProductsFound: data.reduce((sum: number, r: any) => sum + (r.products_found || 0), 0),
      totalPublished: data.reduce((sum: number, r: any) => sum + (r.products_published || 0), 0),
      totalDraft: data.reduce((sum: number, r: any) => sum + (r.products_draft || 0), 0),
      totalRejected: data.reduce((sum: number, r: any) => sum + (r.products_rejected || 0), 0),
      lastRunAt: data[0]?.started_at || null,
      apiCallsUsed: data.reduce((sum: number, r: any) => sum + (r.api_calls_used || 0), 0),
    };
  }

  async runSourcing(config?: Partial<SourcingConfig>): Promise<SourcingResult> {
    const startTime = Date.now();
    const runConfig = { ...DEFAULT_CONFIG, ...config };
    const runId = await this.createRun();

    console.log(`[Sourcing] Starting run ${runId}`);

    const cj = getCJClient();

    if (!cj) {
      await this.updateRun(runId, {
        status: 'failed',
        errorMessage: 'CJ API not configured. Set CJ_API_KEY in .env.local',
        completedAt: new Date().toISOString(),
      });
      return {
        runId,
        status: 'failed',
        productsFound: 0,
        published: 0,
        draft: 0,
        rejected: 0,
        errors: 0,
        duration: Date.now() - startTime,
      };
    }

    // Get current category counts to prioritize
    const categoryCounts = await this.getProductsCountByCategory();
    const categoriesNeedingProducts = categoryCounts
      .filter((c) => c.needed > 0)
      .sort((a, b) => b.needed - a.needed);

    console.log(`[Sourcing] Categories needing products:`, categoriesNeedingProducts.map((c) => `${c.category}: ${c.count}/${runConfig.minProductsPerCategory}`));

    if (categoriesNeedingProducts.length === 0) {
      console.log(`[Sourcing] All categories have ${runConfig.minProductsPerCategory}+ products. Skipping sourcing.`);
      await this.updateRun(runId, {
        status: 'completed',
        productsFound: 0,
        productsPublished: 0,
        productsDraft: 0,
        productsRejected: 0,
        apiCallsUsed: 0,
        completedAt: new Date().toISOString(),
      });
      return {
        runId,
        status: 'completed',
        productsFound: 0,
        published: 0,
        draft: 0,
        rejected: 0,
        errors: 0,
        duration: Date.now() - startTime,
      };
    }

    // Search products per category, prioritizing those with fewer products
    const productsByCategory: Record<string, CJProduct[]> = {};
    let apiCalls = 0;

    for (const catInfo of categoriesNeedingProducts) {
      const category = catInfo.category;
      const keywords = CJ_SEARCH_KEYWORDS[category] || [category.toLowerCase()];
      const maxForCategory = Math.min(
        runConfig.maxProductsPerRun,
        catInfo.needed + 10
      );

      productsByCategory[category] = [];

      for (const keyword of keywords) {
        if (productsByCategory[category].length >= maxForCategory) break;
        try {
          const result = await cj.searchProducts({
            keyword,
            pageSize: Math.min(10, maxForCategory - productsByCategory[category].length),
            minPrice: runConfig.minPrice,
            maxPrice: runConfig.maxPrice,
          });
          apiCalls++;

          const filtered = result.products.filter(
            (p) => p.salePrice >= runConfig.minPrice && p.salePrice <= runConfig.maxPrice
          );
          productsByCategory[category].push(...filtered);

          if (productsByCategory[category].length >= maxForCategory) break;
        } catch (err) {
          console.error(`[Sourcing] Error searching "${keyword}" in ${category}:`, err);
        }
      }
    }

    // Deduplicate by PID per category
    const allProducts: CJProduct[] = [];
    for (const category of Object.keys(productsByCategory)) {
      const seen = new Set<string>();
      const unique = productsByCategory[category].filter((p) => {
        if (seen.has(p.pid)) return false;
        seen.add(p.pid);
        return true;
      });
      allProducts.push(...unique.slice(0, runConfig.maxProductsPerRun));
    }

    console.log(`[Sourcing] Found ${allProducts.length} products from CJ across ${categoriesNeedingProducts.length} categories`);

    await this.updateRun(runId, {
      productsFound: allProducts.length,
      apiCallsUsed: apiCalls,
    });

    // Analyze and publish per category
    const analyzed: Array<{ cjProduct: CJProduct; analysis: ProductAnalysis }> = [];
    let analyzeErrors = 0;

    for (let i = 0; i < allProducts.length; i++) {
      const product = allProducts[i];
      try {
        console.log(`[Sourcing] Analyzing product ${i + 1}/${allProducts.length}: ${product.productNameEn || product.productName}`);
        const analysis = await analyzeProduct(product);
        apiCalls++;

        if (analysis && analysis.analysis.overallScore >= runConfig.minMargin) {
          analyzed.push({ cjProduct: product, analysis });
        }

        // Delay between analyses to avoid AI rate limits
        if (i < allProducts.length - 1) {
          await new Promise((r) => setTimeout(r, 3000));
        }
      } catch (err) {
        console.error(`[Sourcing] Error analyzing product ${product.pid}:`, err);
        analyzeErrors++;
      }
    }

    console.log(`[Sourcing] Analyzed ${analyzed.length} products`);

    const results = await publishBatch(analyzed, runId);

    await this.updateRun(runId, {
      status: 'completed',
      productsPublished: results.published,
      productsDraft: results.draft,
      productsRejected: results.rejected,
      apiCallsUsed: apiCalls,
      completedAt: new Date().toISOString(),
    });

    const duration = Date.now() - startTime;
    console.log(`[Sourcing] Run ${runId} completed in ${duration}ms: ${results.published} published, ${results.draft} draft, ${results.rejected} rejected`);

    return {
      runId,
      status: 'completed',
      productsFound: allProducts.length,
      published: results.published,
      draft: results.draft,
      rejected: results.rejected,
      errors: results.errors + analyzeErrors,
      duration,
    };
  }
}

let instance: ProductSourcingService | null = null;

export function getSourcingService(): ProductSourcingService {
  if (!instance) {
    instance = new ProductSourcingService();
  }
  return instance;
}

export default ProductSourcingService;
