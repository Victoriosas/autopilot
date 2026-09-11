import { GoogleGenAI } from '@google/genai';
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
  scheduleInterval: 21600,
  isEnabled: true,
  categories: ['Electronics', 'Home & Garden', 'Beauty & Health', 'Fashion'],
  minPrice: 5,
  maxPrice: 100,
  minRating: 4.0,
  minMargin: 30,
  autoPublishScore: 85,
  maxProductsPerRun: 50,
};

const CJ_SEARCH_KEYWORDS: Record<string, string[]> = {
  'Electronics': ['bluetooth speaker', 'wireless earbuds', 'smart watch', 'phone holder', 'usb charger'],
  'Home & Garden': ['desk lamp', 'wall art', 'kitchen gadget', 'plant pot', 'candle holder'],
  'Beauty & Health': ['skincare', 'makeup brush', 'face mask', 'hair clipper', 'nail lamp'],
  'Fashion': ['sunglasses', 'wallet', 'jewelry', 'watch', 'belt'],
  'Toys & Hobbies': ['fidget toy', 'puzzle', 'board game', 'rc car', 'model kit'],
  'Sports & Entertainment': ['yoga mat', 'water bottle', 'fitness band', 'camping', 'bike light'],
  'Tools & Home Improvement': ['smart plug', 'led strip', 'storage box', 'screwdriver set', 'tape measure'],
  'Pet Supplies': ['dog toy', 'cat bed', 'pet collar', 'fish tank', 'bird cage'],
  'Baby & Kids': ['baby toy', 'kids puzzle', 'baby bottle', 'stroller', 'diaper bag'],
  'Office & Stationery': ['pen set', 'notebook', 'desk organizer', 'sticky notes', 'calculator'],
};

class ProductSourcingService {
  private supabase: SupabaseClient | null = null;
  private aiClient: GoogleGenAI | null = null;

  private getSupabase(): SupabaseClient {
    if (!this.supabase) {
      const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
      const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
      if (!url || !key) throw new Error('Supabase not configured');
      this.supabase = createClient(url, key);
    }
    return this.supabase;
  }

  private getAI(): GoogleGenAI | null {
    if (!this.aiClient && process.env.GEMINI_API_KEY) {
      this.aiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    }
    return this.aiClient;
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
    const ai = this.getAI();

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

    let allProducts: CJProduct[] = [];
    let apiCalls = 0;

    for (const category of runConfig.categories) {
      const keywords = CJ_SEARCH_KEYWORDS[category] || [category.toLowerCase()];
      for (const keyword of keywords) {
        if (allProducts.length >= runConfig.maxProductsPerRun) break;
        try {
          const result = await cj.searchProducts({
            keyword,
            pageSize: Math.min(10, runConfig.maxProductsPerRun - allProducts.length),
            minPrice: runConfig.minPrice,
            maxPrice: runConfig.maxPrice,
          });
          apiCalls++;

          const filtered = result.products.filter(
            (p) => p.salePrice >= runConfig.minPrice && p.salePrice <= runConfig.maxPrice
          );
          allProducts.push(...filtered);

          if (allProducts.length >= runConfig.maxProductsPerRun) break;
        } catch (err) {
          console.error(`[Sourcing] Error searching "${keyword}":`, err);
        }
      }
      if (allProducts.length >= runConfig.maxProductsPerRun) break;
    }

    // If not enough products from keywords, try trending
    if (allProducts.length < runConfig.maxProductsPerRun) {
      try {
        const trendingResult = await cj.searchProducts({
          keyword: '',
          pageSize: Math.min(20, runConfig.maxProductsPerRun - allProducts.length),
          minPrice: runConfig.minPrice,
          maxPrice: runConfig.maxPrice,
        });
        apiCalls++;
        const trendingFiltered = trendingResult.products.filter(
          (p) => p.salePrice >= runConfig.minPrice && p.salePrice <= runConfig.maxPrice
        );
        allProducts.push(...trendingFiltered);
      } catch (err) {
        console.error('[Sourcing] Error fetching trending:', err);
      }
    }

    // Deduplicate by PID
    const seen = new Set<string>();
    allProducts = allProducts.filter((p) => {
      if (seen.has(p.pid)) return false;
      seen.add(p.pid);
      return true;
    });

    allProducts = allProducts.slice(0, runConfig.maxProductsPerRun);

    console.log(`[Sourcing] Found ${allProducts.length} products from CJ`);

    await this.updateRun(runId, {
      productsFound: allProducts.length,
      apiCallsUsed: apiCalls,
    });

    const analyzed: Array<{ cjProduct: CJProduct; analysis: ProductAnalysis }> = [];
    let analyzeErrors = 0;

    for (const product of allProducts) {
      try {
        const analysis = await analyzeProduct(product, ai);
        apiCalls++;

        if (analysis && analysis.analysis.overallScore >= runConfig.minMargin) {
          analyzed.push({ cjProduct: product, analysis });
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
