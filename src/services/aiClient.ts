export interface AIProvider {
  name: string;
  baseUrl: string;
  apiKey: string;
  model: string;
  priority: number;
}

export interface AIResponse {
  text: string;
  provider: string;
  model: string;
}

function getProviders(): AIProvider[] {
  return [
    {
      name: 'Groq',
      baseUrl: 'https://api.groq.com/openai/v1',
      apiKey: process.env.GROQ_API_KEY || '',
      model: 'openai/gpt-oss-20b',
      priority: 1,
    },
    {
      name: 'Cerebras',
      baseUrl: 'https://api.cerebras.ai/v1',
      apiKey: process.env.CEREBRAS_API_KEY || '',
      model: 'gpt-oss-120b',
      priority: 2,
    },
    {
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      apiKey: process.env.OPENROUTER_API_KEY || '',
      model: 'inclusionai/ling-3.0-flash-vl:free',
      priority: 3,
    },
  ];
}

function getActiveProviders(): AIProvider[] {
  return getProviders().filter((p) => p.apiKey && p.apiKey.trim() !== '').sort(
    (a, b) => a.priority - b.priority
  );
}

async function callOpenAICompatible(
  provider: AIProvider,
  prompt: string,
  jsonMode: boolean = false
): Promise<string> {
  const body: any = {
    model: provider.model,
    messages: [
      {
        role: 'system',
        content:
          'Eres un asistente de análisis de productos prémium. Responde SIEMPRE en JSON válido.',
      },
      { role: 'user', content: prompt },
    ],
    temperature: 0.3,
    max_tokens: 2000,
  };

  if (jsonMode) {
    body.response_format = { type: 'json_object' };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });

    clearTimeout(timeout);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(
        `${provider.name} HTTP ${response.status}: ${errText.substring(0, 200)}`
      );
    }

    const data = await response.json();
    return data.choices?.[0]?.message?.content || '';
  } catch (err: any) {
    clearTimeout(timeout);
    if (err.name === 'AbortError') {
      throw new Error(`${provider.name}: timeout after 30s`);
    }
    throw err;
  }
}

export async function aiCompletion(
  prompt: string,
  jsonMode: boolean = true
): Promise<AIResponse> {
  const providers = getActiveProviders();

  if (providers.length === 0) {
    throw new Error(
      'No AI providers configured. Set GROQ_API_KEY, CEREBRAS_API_KEY, or OPENROUTER_API_KEY in .env.local'
    );
  }

  let lastError: Error | null = null;

  for (const provider of providers) {
    try {
      console.log(`[AI] Trying ${provider.name} (${provider.model})...`);
      const text = await callOpenAICompatible(provider, prompt, jsonMode);

      if (text && text.trim().length > 10) {
        console.log(`[AI] Success with ${provider.name}`);
        return { text, provider: provider.name, model: provider.model };
      }

      throw new Error('Empty response from provider');
    } catch (err: any) {
      console.warn(`[AI] ${provider.name} failed: ${err.message}`);
      lastError = err;

      if (err.message.includes('429') || err.message.includes('rate limit')) {
        console.log(`[AI] Rate limited on ${provider.name}, trying next...`);
        continue;
      }

      if (err.message.includes('timeout') || err.message.includes('abort')) {
        console.log(`[AI] Timeout on ${provider.name}, trying next...`);
        continue;
      }

      continue;
    }
  }

  throw lastError || new Error('All AI providers failed');
}

export async function aiStructuredCompletion<T>(
  prompt: string,
  fallbackValue: T
): Promise<T> {
  try {
    const response = await aiCompletion(prompt, true);

    let jsonStr = response.text.trim();

    const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (jsonMatch) {
      jsonStr = jsonMatch[1].trim();
    }

    const parsed = JSON.parse(jsonStr);
    return parsed as T;
  } catch (err: any) {
    console.warn(`[AI] Structured completion failed: ${err.message}, using fallback`);
    return fallbackValue;
  }
}

export function getProviderStatus(): { name: string; configured: boolean; priority: number }[] {
  return getProviders().map((p) => ({
    name: p.name,
    configured: !!(p.apiKey && p.apiKey.trim()),
    priority: p.priority,
  }));
}
