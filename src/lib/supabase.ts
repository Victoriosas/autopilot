import { createClient } from '@supabase/supabase-js';
import type { Database } from '../types';

const configuredSupabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const configuredSupabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

// These defaults are publishable client credentials, not secrets. Keeping them here
// ensures the storefront and admin login stay connected even if Vercel build-time
// public variables are missing. Server-side privileged access still requires a
// separate service-role key and is never embedded in the browser bundle.
const DEFAULT_SUPABASE_URL = 'https://jfjzpwlrhzqbcrvqxhzf.supabase.co';
const DEFAULT_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_NkSRyoiQRHOClEQwdOgwvw_IFzxChY3';

const supabaseUrl = configuredSupabaseUrl || DEFAULT_SUPABASE_URL;
const supabaseAnonKey = configuredSupabaseAnonKey || DEFAULT_SUPABASE_PUBLISHABLE_KEY;

export const isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey);

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export default supabase;
