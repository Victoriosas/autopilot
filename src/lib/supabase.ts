import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types';

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

export const isSupabaseConfigured = Boolean(configuredSupabaseUrl && configuredSupabaseAnonKey);

if (!isSupabaseConfigured) {
  console.warn(
    '[Victoriosa] Supabase public environment variables are missing. The storefront will stay available, but authentication and live catalog data are disabled until VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are configured in Vercel.',
  );
}

// Supabase validates URL/key synchronously during module initialization. Using an
// inert, syntactically valid fallback prevents a missing Vercel build variable from
// crashing React before the storefront can render. It does not grant data access.
const supabaseUrl = configuredSupabaseUrl || 'https://placeholder.supabase.co';
const supabaseAnonKey = configuredSupabaseAnonKey || 'public-placeholder-anon-key';

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: isSupabaseConfigured,
    persistSession: isSupabaseConfigured,
    detectSessionInUrl: isSupabaseConfigured,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
