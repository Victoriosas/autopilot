import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { createClient } from '@supabase/supabase-js';

const TOKEN_PROVIDER = 'mercadolibre';
const DEFAULT_REDIRECT = 'https://victoriosas.online/api/integrations/mercadolibre/callback';

function adminDb() {
  const url = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('MERCADOLIBRE_TOKEN_STORE_NOT_CONFIGURED');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

function tokenEncryptionKey(env: NodeJS.ProcessEnv = process.env): Buffer | null {
  const raw = env.MERCADOLIBRE_TOKEN_ENCRYPTION_KEY?.trim() || '';
  if (!raw) return null;
  const key = /^[0-9a-f]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
  return key.length === 32 ? key : null;
}

function encryptToken(value: string): string {
  const key = tokenEncryptionKey();
  if (!key) throw new Error('MERCADOLIBRE_TOKEN_ENCRYPTION_NOT_CONFIGURED');
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const ciphertext = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  return ['v1', iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), ciphertext.toString('base64url')].join(':');
}

function decryptToken(value: string | null | undefined): string | null {
  if (!value) return null;
  const key = tokenEncryptionKey();
  if (!key) throw new Error('MERCADOLIBRE_TOKEN_ENCRYPTION_NOT_CONFIGURED');
  const [version, ivRaw, tagRaw, ciphertextRaw] = value.split(':');
  if (version !== 'v1' || !ivRaw || !tagRaw || !ciphertextRaw) throw new Error('MERCADOLIBRE_TOKEN_CIPHERTEXT_INVALID');
  const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(ivRaw, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagRaw, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextRaw, 'base64url')), decipher.final()]).toString('utf8');
}

export function mercadoLibreOAuthConfig(env: NodeJS.ProcessEnv = process.env) {
  const clientId = env.MERCADOLIBRE_CLIENT_ID?.trim() || '';
  const clientSecret = env.MERCADOLIBRE_CLIENT_SECRET?.trim() || '';
  const redirectUri = env.MERCADOLIBRE_REDIRECT_URI?.trim() || DEFAULT_REDIRECT;
  const encryptedStore = Boolean(tokenEncryptionKey(env));
  return { clientId, clientSecret, redirectUri, encryptedStore, configured: Boolean(clientId && clientSecret && redirectUri && encryptedStore) };
}
type TokenPayload = {
  access_token: string;
  refresh_token?: string;
  token_type?: string;
  expires_in?: number;
  scope?: string;
  user_id?: number | string;
};

async function exchangeToken(params: URLSearchParams): Promise<TokenPayload> {
  const response = await fetch('https://api.mercadolibre.com/oauth/token', {
    method: 'POST',
    headers: { accept: 'application/json', 'content-type': 'application/x-www-form-urlencoded' },
    body: params.toString(),
    signal: AbortSignal.timeout(10000),
  });
  const body: any = await response.json().catch(() => ({}));
  if (!response.ok || !body?.access_token) throw new Error(`MERCADOLIBRE_OAUTH_HTTP_${response.status}`);
  return body as TokenPayload;
}
async function persistToken(token: TokenPayload, fallbackRefreshToken?: string) {
  const expiresAt = new Date(Date.now() + Math.max(60, Number(token.expires_in || 21600)) * 1000).toISOString();
  const refreshToken = token.refresh_token || fallbackRefreshToken || null;
  const row = {
    provider: TOKEN_PROVIDER,
    access_token_ciphertext: encryptToken(token.access_token),
    refresh_token_ciphertext: refreshToken ? encryptToken(refreshToken) : null,
    token_type: token.token_type || 'Bearer',
    expires_at: expiresAt,
    scope: token.scope || null,
    external_user_id: token.user_id ? String(token.user_id) : null,
    metadata: { source: 'oauth_authorization_code', country: 'UY' },
    updated_at: new Date().toISOString(),
  };
  const { error } = await adminDb().from('provider_oauth_tokens').upsert(row, { onConflict: 'provider' });
  if (error) throw new Error('MERCADOLIBRE_TOKEN_STORE_FAILED');
  return row;
}

export async function exchangeMercadoLibreAuthorizationCode(code: string) {
  const config = mercadoLibreOAuthConfig();
  if (!config.configured) throw new Error('MERCADOLIBRE_OAUTH_NOT_CONFIGURED');
  const params = new URLSearchParams({ grant_type: 'authorization_code', client_id: config.clientId, client_secret: config.clientSecret, code, redirect_uri: config.redirectUri });
  return persistToken(await exchangeToken(params));
}
async function refreshMercadoLibreToken(refreshToken: string) {
  const config = mercadoLibreOAuthConfig();
  if (!config.configured) throw new Error('MERCADOLIBRE_OAUTH_NOT_CONFIGURED');
  const params = new URLSearchParams({ grant_type: 'refresh_token', client_id: config.clientId, client_secret: config.clientSecret, refresh_token: refreshToken });
  return persistToken(await exchangeToken(params), refreshToken);
}

async function loadTokenRow() {
  const { data, error } = await adminDb().from('provider_oauth_tokens')
    .select('provider,access_token_ciphertext,refresh_token_ciphertext,token_type,expires_at,scope,external_user_id,updated_at')
    .eq('provider', TOKEN_PROVIDER).maybeSingle();
  if (error) throw new Error('MERCADOLIBRE_TOKEN_STORE_UNAVAILABLE');
  return data as any;
}

export async function getMercadoLibreAccessToken(): Promise<string | null> {
  const envToken = process.env.MERCADOLIBRE_ACCESS_TOKEN?.trim() || process.env.ML_ACCESS_TOKEN?.trim();
  if (envToken) return envToken;
  const row = await loadTokenRow();
  const accessToken = decryptToken(row?.access_token_ciphertext);
  if (!accessToken) return null;
  const expiresAt = Date.parse(row.expires_at || '');
  if (Number.isFinite(expiresAt) && expiresAt > Date.now() + 60 * 1000) return accessToken;
  const refreshToken = decryptToken(row.refresh_token_ciphertext);
  if (!refreshToken) return null;
  const refreshed = await refreshMercadoLibreToken(refreshToken);
  return decryptToken(refreshed.access_token_ciphertext);
}
export async function mercadoLibreConnectionStatus() {
  const config = mercadoLibreOAuthConfig();
  let row: any = null;
  try { row = await loadTokenRow(); } catch { /* status stays disconnected */ }
  const expiresAt = row?.expires_at || null;
  const envToken = process.env.MERCADOLIBRE_ACCESS_TOKEN?.trim() || process.env.ML_ACCESS_TOKEN?.trim();
  const stored = Boolean(row?.access_token_ciphertext);
  const refreshable = Boolean(row?.refresh_token_ciphertext && config.configured);
  const connected = Boolean(envToken) || (stored && ((!expiresAt || Date.parse(expiresAt) > Date.now()) || refreshable));
  return {
    configured: config.configured || Boolean(envToken),
    connected,
    expiresAt,
    externalUserId: row?.external_user_id || null,
    redirectUri: config.redirectUri,
    encryptedStore: config.encryptedStore,
    tokenSource: stored ? 'oauth_store_encrypted' : (envToken ? 'environment' : null),
  };
}

export function mercadoLibreAuthorizationUrl(state: string) {
  const config = mercadoLibreOAuthConfig();
  if (!config.configured) throw new Error('MERCADOLIBRE_OAUTH_NOT_CONFIGURED');
  const url = new URL('https://auth.mercadolibre.com.uy/authorization');
  url.searchParams.set('response_type', 'code');
  url.searchParams.set('client_id', config.clientId);
  url.searchParams.set('redirect_uri', config.redirectUri);
  url.searchParams.set('state', state);
  return url.toString();
}
