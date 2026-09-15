import assert from 'node:assert/strict';
import test from 'node:test';
import {
  heuristicEnglishKeyword,
  isLikelySpanishProductQuery,
  optimizeCJSearchKeyword,
} from './searchKeywordOptimizer';

test('detects common Spanish beauty product searches', () => {
  assert.equal(isLikelySpanishProductQuery('MASCARILLA LIMPIADORA'), true);
  assert.equal(isLikelySpanishProductQuery('organizador de maquillaje'), true);
  assert.equal(isLikelySpanishProductQuery('pearl facial headband'), false);
});

test('provides a local English fallback for Spanish CJ searches', () => {
  assert.equal(heuristicEnglishKeyword('MASCARILLA LIMPIADORA'), 'facial cleansing mask');
  assert.equal(heuristicEnglishKeyword('vincha facial'), 'facial headband');
  assert.equal(heuristicEnglishKeyword('organizador de maquillaje'), 'makeup organizer');
});

test('passes English queries through unchanged', async () => {
  const result = await optimizeCJSearchKeyword('pearl facial headband', { env: {} as NodeJS.ProcessEnv });
  assert.deepEqual(result, {
    input: 'pearl facial headband',
    keyword: 'pearl facial headband',
    translated: false,
    detectedLanguage: 'other',
    provider: 'passthrough',
  });
});

test('uses configured OpenRouter to optimize Spanish search terms', async () => {
  const fetcher = (async (_url: string | URL | Request, init?: RequestInit) => {
    const body = JSON.parse(String(init?.body || '{}'));
    assert.match(body.messages[1].content, /MASCARILLA LIMPIADORA/);
    return new Response(JSON.stringify({
      choices: [{ message: { content: '{"keyword":"facial cleansing mask"}' } }],
    }), { status: 200, headers: { 'content-type': 'application/json' } });
  }) as typeof fetch;

  const result = await optimizeCJSearchKeyword('MASCARILLA LIMPIADORA', {
    env: { OPENROUTER_API_KEY: 'test-key' } as NodeJS.ProcessEnv,
    fetcher,
  });

  assert.equal(result.keyword, 'facial cleansing mask');
  assert.equal(result.provider, 'openrouter');
  assert.equal(result.detectedLanguage, 'es');
  assert.equal(result.translated, true);
});

test('falls back locally when the translation provider is unavailable', async () => {
  const fetcher = (async () => new Response('', { status: 503 })) as typeof fetch;
  const result = await optimizeCJSearchKeyword('cepillo limpiador facial', {
    env: { OPENROUTER_API_KEY: 'test-key' } as NodeJS.ProcessEnv,
    fetcher,
  });
  assert.equal(result.keyword, 'facial cleansing brush');
  assert.equal(result.provider, 'heuristic');
});
