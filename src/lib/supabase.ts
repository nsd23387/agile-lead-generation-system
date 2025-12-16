import { createClient, type SupabaseClient } from '@supabase/supabase-js';

/**
 * Optional Supabase client.
 *
 * Provide these in your environment (Vite):
 * - VITE_SUPABASE_URL
 * - VITE_SUPABASE_ANON_KEY
 */
export function getSupabaseClient(): SupabaseClient | null {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

  if (!url || !anonKey) return null;
  return createClient(url, anonKey);
}
