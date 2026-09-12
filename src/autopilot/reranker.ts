import { selectModel } from './modelRouter';

export interface RerankDocument<T = unknown> {
  text: string;
  metadata?: T;
}

export interface RerankResult<T = unknown> {
  index: number;
  relevanceScore: number;
  document: RerankDocument<T>;
}

interface OpenRouterRerankResponse {
  results?: Array<{
    index: number;
    relevance_score: number;
    document?: { text?: string };
  }>;
}

export async function rerankDocuments<T = unknown>(
  query: string,
  documents: RerankDocument<T>[],
  topN = 10
): Promise<RerankResult<T>[]> {
  if (!query.trim()) throw new Error('Rerank query is required');
  if (documents.length === 0) return [];

  const route = selectModel('rerank');
  if (route.provider !== 'openrouter') {
    throw new Error(`Unsupported rerank provider: ${route.provider}`);
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) throw new Error('OPENROUTER_API_KEY is not configured');

  const safeTopN = Math.max(1, Math.min(topN, documents.length));
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);

  try {
    const response = await fetch('https://openrouter.ai/api/v1/rerank', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
        ...(process.env.OPENROUTER_SITE_URL
          ? { 'HTTP-Referer': process.env.OPENROUTER_SITE_URL }
          : {}),
        'X-OpenRouter-Title': process.env.OPENROUTER_APP_NAME || 'Victoriosa Autopilot',
      },
      body: JSON.stringify({
        model: route.model,
        query,
        documents: documents.map((document) => document.text),
        top_n: safeTopN,
      }),
      signal: controller.signal,
    });

    if (!response.ok) {
      const body = await response.text().catch(() => '');
      throw new Error(`OpenRouter rerank HTTP ${response.status}: ${body.slice(0, 300)}`);
    }

    const payload = (await response.json()) as OpenRouterRerankResponse;
    const results = payload.results || [];

    return results
      .filter((item) => Number.isInteger(item.index) && documents[item.index])
      .map((item) => ({
        index: item.index,
        relevanceScore: Number(item.relevance_score || 0),
        document: documents[item.index],
      }));
  } finally {
    clearTimeout(timeout);
  }
}
