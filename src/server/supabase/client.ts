/**
 * Server-side Supabase client
 *
 * This module provides a singleton Supabase client for server-side operations.
 * Uses the secret key for admin access, bypassing RLS when needed.
 *
 * IMPORTANT: Only use this client on the server side (API routes, server components).
 * Never expose the secret key to the browser.
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './types';

// Singleton instance
let supabaseClient: SupabaseClient<Database> | null = null;

/**
 * Get the server-side Supabase client singleton
 *
 * Uses secret key for admin access. This client:
 * - Bypasses RLS by default (be careful!)
 * - Should only be used server-side
 * - Is configured for server environments (no session persistence)
 *
 * @returns Typed Supabase client
 * @throws Error if environment variables are not configured
 */
export function getSupabaseClient(): SupabaseClient<Database> {
  if (supabaseClient) {
    return supabaseClient;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error(
      'NEXT_PUBLIC_SUPABASE_URL is not set. ' +
      'Copy from `supabase status` output to .env.local'
    );
  }

  if (!supabaseSecretKey) {
    throw new Error(
      'SUPABASE_SECRET_KEY is not set. ' +
      'Copy from `supabase status` output to .env.local'
    );
  }

  supabaseClient = createClient<Database>(supabaseUrl, supabaseSecretKey, {
    auth: {
      // Server-side: don't persist sessions
      autoRefreshToken: false,
      persistSession: false,
    },
  });

  return supabaseClient;
}

/**
 * Get a Supabase client that respects RLS for a specific user
 *
 * Use this when you want RLS policies to be applied based on a user's JWT.
 * This is useful for API routes that should respect user permissions.
 *
 * @param accessToken - User's JWT access token
 * @returns Typed Supabase client with user context
 */
export function getSupabaseClientWithAuth(accessToken: string): SupabaseClient<Database> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabasePublishableKey) {
    throw new Error(
      'Supabase environment variables not configured. ' +
      'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY'
    );
  }

  return createClient<Database>(supabaseUrl, supabasePublishableKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
    global: {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    },
  });
}

/**
 * Get a Supabase client, choosing between RLS-respecting and service_role based on context.
 *
 * Use this in repositories to enable RLS-backed access control:
 * - If accessToken is provided: Returns client with user's JWT (respects RLS)
 * - If no accessToken: Returns service_role client (bypasses RLS, for admin ops)
 *
 * This enables defense-in-depth: even if API has authorization bugs, RLS policies
 * enforce access control at the database level.
 *
 * @param accessToken - Optional JWT access token. If provided, RLS policies apply.
 * @returns Typed Supabase client
 */
export function getClient(accessToken?: string): SupabaseClient<Database> {
  return accessToken
    ? getSupabaseClientWithAuth(accessToken)
    : getSupabaseClient();
}

/**
 * Type helpers for database operations
 */
export type Tables = Database['public']['Tables'];
export type Enums = Database['public']['Enums'];

// Table row types
export type NamespaceRow = Tables['namespaces']['Row'];
export type UserProfileRow = Tables['user_profiles']['Row'];
export type ClassRow = Tables['classes']['Row'];
export type SectionRow = Tables['sections']['Row'];
export type SectionMembershipRow = Tables['section_memberships']['Row'];
export type ProblemRow = Tables['problems']['Row'];
export type SessionRow = Tables['sessions']['Row'];
export type SessionStudentRow = Tables['session_students']['Row'];
export type RevisionRow = Tables['revisions']['Row'];
export type InvitationRow = Tables['invitations']['Row'];

// Table insert types
export type NamespaceInsert = Tables['namespaces']['Insert'];
export type UserProfileInsert = Tables['user_profiles']['Insert'];
export type ClassInsert = Tables['classes']['Insert'];
export type SectionInsert = Tables['sections']['Insert'];
export type SectionMembershipInsert = Tables['section_memberships']['Insert'];
export type ProblemInsert = Tables['problems']['Insert'];
export type SessionInsert = Tables['sessions']['Insert'];
export type SessionStudentInsert = Tables['session_students']['Insert'];
export type RevisionInsert = Tables['revisions']['Insert'];
export type InvitationInsert = Tables['invitations']['Insert'];

// Table update types
export type NamespaceUpdate = Tables['namespaces']['Update'];
export type UserProfileUpdate = Tables['user_profiles']['Update'];
export type ClassUpdate = Tables['classes']['Update'];
export type SectionUpdate = Tables['sections']['Update'];
export type SectionMembershipUpdate = Tables['section_memberships']['Update'];
export type ProblemUpdate = Tables['problems']['Update'];
export type SessionUpdate = Tables['sessions']['Update'];
export type SessionStudentUpdate = Tables['session_students']['Update'];
export type RevisionUpdate = Tables['revisions']['Update'];
export type InvitationUpdate = Tables['invitations']['Update'];
