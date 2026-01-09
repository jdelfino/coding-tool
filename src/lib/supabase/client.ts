/**
 * Browser-side Supabase client
 *
 * This module provides the Supabase client for browser/client components.
 * Uses the publishable key and respects RLS policies based on user authentication.
 */

import { createBrowserClient } from '@supabase/ssr';
import { Database } from '@/server/supabase/types';

// Singleton instance for browser
let browserClient: ReturnType<typeof createBrowserClient<Database>> | null = null;

/**
 * Get the browser-side Supabase client
 *
 * Uses the publishable key and respects RLS policies. Safe to use in client components.
 * Creates a singleton instance that persists across renders.
 *
 * @returns Typed Supabase client for browser use
 */
export function getSupabaseBrowserClient() {
  if (browserClient) {
    return browserClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. ' +
      'Ensure environment variables are configured.'
    );
  }

  if (!supabasePublishableKey) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY is not set. ' +
      'Ensure environment variables are configured.'
    );
  }

  browserClient = createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);

  return browserClient;
}

/**
 * Create a new browser client (non-singleton)
 *
 * Use this when you need a fresh client instance, for example in tests
 * or when you need to reset authentication state.
 *
 * @returns New typed Supabase client
 */
export function createSupabaseBrowserClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error('Supabase environment variables not configured.');
  }

  return createBrowserClient<Database>(supabaseUrl, supabasePublishableKey);
}
