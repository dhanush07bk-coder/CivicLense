import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../types/database.types';

export type BackendMode = 'supabase' | 'demo';
export type CivicSupabaseClient = SupabaseClient<Database>;

const PLACEHOLDER_HOSTS = ['your-project-ref.supabase.co', 'example.supabase.co'];
const PLACEHOLDER_KEYS = ['your-supabase-anon-key', 'MY_SUPABASE_ANON_KEY'];

function readEnvValue(key: 'VITE_SUPABASE_URL' | 'VITE_SUPABASE_ANON_KEY'): string {
  const metaEnv = (import.meta as { env?: Record<string, string | undefined> }).env;
  const fromVite = metaEnv?.[key];
  if (typeof fromVite === 'string' && fromVite.trim()) {
    return fromVite.trim();
  }
  if (typeof process !== 'undefined' && process.env?.[key]) {
    return process.env[key]!.trim();
  }
  return '';
}

export function hasValidSupabaseEnv(url?: string, anonKey?: string): boolean {
  const cleanUrl = (url ?? '').trim();
  const cleanKey = (anonKey ?? '').trim();
  if (!cleanUrl || !cleanKey) return false;

  if (PLACEHOLDER_KEYS.includes(cleanKey)) return false;

  try {
    const parsed = new URL(cleanUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') {
      return false;
    }
    if (PLACEHOLDER_HOSTS.includes(parsed.hostname.toLowerCase())) {
      return false;
    }
    return cleanKey.length >= 20;
  } catch {
    return false;
  }
}

export const supabaseUrl = readEnvValue('VITE_SUPABASE_URL');
export const supabaseAnonKey = readEnvValue('VITE_SUPABASE_ANON_KEY');
export const isSupabaseConfigured = hasValidSupabaseEnv(
  supabaseUrl,
  supabaseAnonKey,
);

export const supabase: CivicSupabaseClient | null = isSupabaseConfigured
  ? createClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getBackendMode(): BackendMode {
  return isSupabaseConfigured ? 'supabase' : 'demo';
}

export function requireSupabaseClient(
  clientOverride?: SupabaseClient | null,
): CivicSupabaseClient {
  const client = (clientOverride as CivicSupabaseClient | null | undefined) ?? supabase;
  if (!client) {
    throw new Error(
      'Supabase backend is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY to connect.',
    );
  }
  return client;
}

export function formatSupabaseError(
  err: unknown,
  fallbackMessage: string,
): string {
  if (!err) return fallbackMessage;

  const maybeObj = err as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
    status?: number;
  };

  const msg =
    err instanceof Error
      ? err.message
      : typeof maybeObj?.message === 'string'
        ? maybeObj.message
        : '';
  const code = typeof maybeObj?.code === 'string' ? maybeObj.code : '';
  const lower = msg.toLowerCase();

  if (
    lower.includes('failed to fetch') ||
    lower.includes('networkerror') ||
    lower.includes('fetch failed')
  ) {
    return 'Network error while reaching Civilense backend. Check your internet connection and try again.';
  }

  if (
    code === '42703' ||
    lower.includes('column') && lower.includes('does not exist')
  ) {
    return 'A required database field could not be matched. Please verify the Supabase schema migrations.';
  }

  if (code === '23505' || lower.includes('already registered') || lower.includes('duplicate')) {
    return msg || 'A duplicate record already exists.';
  }

  if (
    code === '42501' ||
    maybeObj?.status === 403 ||
    lower.includes('row-level security') ||
    lower.includes('permission denied')
  ) {
    return msg || 'You do not have permission to perform this action.';
  }

  if (lower.includes('invalid login credentials')) {
    return 'Invalid email or password.';
  }

  if (lower.includes('email not confirmed')) {
    return 'Please verify your email address before signing in. Use "Resend verification email" if needed.';
  }

  if (lower.includes('user already registered')) {
    return 'An account with this email already exists. Try signing in or resetting your password.';
  }

  if (lower.includes('jwt expired') || maybeObj?.status === 401) {
    return 'Your session has expired. Please sign in again.';
  }

  if (msg.trim()) {
    return msg;
  }

  return fallbackMessage;
}
