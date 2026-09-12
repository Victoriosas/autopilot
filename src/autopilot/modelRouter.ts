export type ModelTask =
  | 'classification'
  | 'extraction'
  | 'structured_analysis'
  | 'deep_reasoning'
  | 'code_review'
  | 'rerank';

export interface ModelRoute {
  provider: 'groq' | 'openrouter' | 'cerebras' | 'codex';
  model: string;
  reason: string;
  requiresKey?: 'GROQ_API_KEY' | 'OPENROUTER_API_KEY' | 'CEREBRAS_API_KEY';
}

const ROUTES: Record<ModelTask, ModelRoute[]> = {
  classification: [
    {
      provider: 'groq',
      model: process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b',
      reason: 'Fast, low-latency classification and routing',
      requiresKey: 'GROQ_API_KEY',
    },
    {
      provider: 'openrouter',
      model: process.env.OPENROUTER_FAST_MODEL || 'qwen/qwen3-8b',
      reason: 'Fallback for lightweight classification',
      requiresKey: 'OPENROUTER_API_KEY',
    },
  ],
  extraction: [
    {
      provider: 'groq',
      model: process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b',
      reason: 'Fast structured extraction',
      requiresKey: 'GROQ_API_KEY',
    },
    {
      provider: 'openrouter',
      model: process.env.OPENROUTER_FAST_MODEL || 'qwen/qwen3-8b',
      reason: 'Fallback extraction route',
      requiresKey: 'OPENROUTER_API_KEY',
    },
  ],
  structured_analysis: [
    {
      provider: 'groq',
      model: process.env.GROQ_ANALYSIS_MODEL || 'openai/gpt-oss-20b',
      reason: 'Primary structured product analysis',
      requiresKey: 'GROQ_API_KEY',
    },
    {
      provider: 'cerebras',
      model: process.env.CEREBRAS_ANALYSIS_MODEL || 'gpt-oss-120b',
      reason: 'Large-model fallback for analysis',
      requiresKey: 'CEREBRAS_API_KEY',
    },
  ],
  deep_reasoning: [
    {
      provider: 'cerebras',
      model: process.env.CEREBRAS_REASONING_MODEL || 'gpt-oss-120b',
      reason: 'Higher-capability reasoning route',
      requiresKey: 'CEREBRAS_API_KEY',
    },
    {
      provider: 'openrouter',
      model: process.env.OPENROUTER_REASONING_MODEL || 'qwen/qwen3-8b',
      reason: 'Reasoning fallback via OpenRouter',
      requiresKey: 'OPENROUTER_API_KEY',
    },
  ],
  code_review: [
    {
      provider: 'codex',
      model: process.env.CODEX_REVIEW_MODEL || 'codex-governor',
      reason: 'Governed review of code changes before merge',
    },
  ],
  rerank: [
    {
      provider: 'openrouter',
      model: process.env.OPENROUTER_RERANK_MODEL || 'qwen/qwen3-reranker-8b',
      reason: 'Multilingual reranking for product, RAG, and code retrieval',
      requiresKey: 'OPENROUTER_API_KEY',
    },
  ],
};

function isConfigured(route: ModelRoute): boolean {
  if (!route.requiresKey) return true;
  return Boolean(process.env[route.requiresKey]?.trim());
}

export function getModelCandidates(task: ModelTask): ModelRoute[] {
  return ROUTES[task].filter(isConfigured);
}

export function selectModel(task: ModelTask): ModelRoute {
  const configured = getModelCandidates(task);
  if (configured.length === 0) {
    throw new Error(`No configured model route for task: ${task}`);
  }
  return configured[0];
}

export function getModelRouterStatus() {
  return (Object.keys(ROUTES) as ModelTask[]).map((task) => ({
    task,
    routes: ROUTES[task].map((route) => ({
      provider: route.provider,
      model: route.model,
      configured: isConfigured(route),
      reason: route.reason,
    })),
  }));
}
