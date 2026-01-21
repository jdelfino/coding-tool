/**
 * Supabase Auth provider implementation
 *
 * Implements authentication using Supabase Auth with email/password.
 * Users are stored in auth.users (managed by Supabase) with extended
 * profile data in user_profiles table.
 */

import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { NextRequest } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';

import { IAuthProvider, IUserRepository } from './interfaces';
import { User, UserRole, AuthSession } from './types';
import { SupabaseUserRepository } from '../persistence/supabase/user-repository';

/**
 * Supabase Auth provider implementation.
 * Manages authentication via Supabase Auth and user profiles in user_profiles table.
 */
export class SupabaseAuthProvider implements IAuthProvider {
  readonly userRepository: IUserRepository;
  private serviceRoleClient: SupabaseClient;

  constructor() {
    // Initialize user repository
    this.userRepository = new SupabaseUserRepository();

    // Secret key client for admin operations (bypasses RLS)
    this.serviceRoleClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SECRET_KEY!,
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      }
    );
  }

  /**
   * Get Supabase client for server operations (respects RLS)
   */
  private async getServerClient() {
    const cookieStore = await cookies();
    return createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value;
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set(name, value, options);
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.set(name, '', options);
          },
        },
      }
    );
  }

  /**
   * Get Supabase client by context type
   */
  getSupabaseClient(context: 'server'): Promise<SupabaseClient>;
  getSupabaseClient(context: 'admin'): SupabaseClient;
  getSupabaseClient(context: 'server' | 'admin'): SupabaseClient | Promise<SupabaseClient> {
    return context === 'admin' ? this.serviceRoleClient : this.getServerClient();
  }

  /**
   * Authenticate user with email and password
   */
  async authenticateWithPassword(email: string, password: string): Promise<User | null> {
    const supabase = await this.getServerClient();

    // Sign in via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      console.error('[SupabaseAuthProvider] Authentication failed:', error?.message);
      return null;
    }

    // Fetch user profile using authenticated context (RLS enforces access)
    const { data: profile, error: profileError } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', data.user.id)
      .single();

    if (profileError || !profile) {
      console.error('[SupabaseAuthProvider] Profile fetch failed:', profileError?.message);
      return null;
    }

    return this.mapToUser(data.user, profile);
  }

  /**
   * Register a new user
   */
  async signUp(
    email: string,
    password: string,
    role: UserRole,
    namespaceId?: string | null
  ): Promise<User> {
    try {
      // 1. Create auth.users via Supabase Admin API
      const { data, error } = await this.serviceRoleClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true, // Auto-confirm email (no verification required)
      });

      if (error || !data.user) {
        throw new Error(`Failed to create auth user: ${error?.message || 'Unknown error'}`);
      }

      // 2. Create user_profiles row
      // Note: email is stored in auth.users, not user_profiles
      const { error: profileError } = await this.serviceRoleClient
        .from('user_profiles')
        .insert({
          id: data.user.id,
          role,
          namespace_id: namespaceId || null,
          created_at: new Date().toISOString(),
        });

      if (profileError) {
        // Rollback: delete auth user
        await this.serviceRoleClient.auth.admin.deleteUser(data.user.id);
        throw new Error(`Profile creation failed: ${profileError.message}`);
      }

      // Return the new user
      return {
        id: data.user.id,
        email,
        role,
        namespaceId: namespaceId || null,
        createdAt: new Date(data.user.created_at),
        emailConfirmed: data.user.email_confirmed_at != null,
      };
    } catch (error: any) {
      console.error('[SupabaseAuthProvider] Sign up failed:', error.message);
      throw error;
    }
  }

  /**
   * Get session from Next.js request (reads JWT from cookies)
   */
  async getSessionFromRequest(request: NextRequest): Promise<AuthSession | null> {
    try {
      // Create client that can read from the request cookies
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
        {
          cookies: {
            get: (name: string) => request.cookies.get(name)?.value,
          },
        }
      );

      // SECURITY: Use getUser() instead of getSession() to verify the JWT
      // with Supabase Auth server. getSession() only reads from cookies
      // without verification, allowing attackers to spoof user.id.
      // See: https://supabase.com/docs/reference/javascript/auth-getsession
      const { data, error } = await supabase.auth.getUser();

      if (error || !data.user) {
        return null;
      }

      // Fetch user profile using authenticated context (RLS enforces access)
      const { data: profile, error: profileError } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        console.error('[SupabaseAuthProvider] Profile fetch failed:', profileError?.message);
        return null;
      }

      // Get access token from session for sessionId field
      // This is safe since we've already verified the user with getUser()
      const { data: sessionData } = await supabase.auth.getSession();
      const accessToken = sessionData?.session?.access_token ?? data.user.id;

      return {
        sessionId: accessToken,
        user: this.mapToUser(data.user, profile),
        createdAt: new Date(data.user.created_at),
      };
    } catch (error: any) {
      console.error('[SupabaseAuthProvider] getSessionFromRequest failed:', error.message);
      return null;
    }
  }

  /**
   * Get session by JWT access token
   */
  async getSession(accessToken: string): Promise<AuthSession | null> {
    try {
      const { data, error } = await this.serviceRoleClient.auth.getUser(accessToken);

      if (error || !data.user) {
        return null;
      }

      // Fetch user profile
      const { data: profile, error: profileError } = await this.serviceRoleClient
        .from('user_profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        return null;
      }

      return {
        sessionId: accessToken,
        user: this.mapToUser(data.user, profile),
        createdAt: new Date(data.user.created_at),
      };
    } catch (error: any) {
      console.error('[SupabaseAuthProvider] getSession failed:', error.message);
      return null;
    }
  }

  /**
   * Sign out (destroy session)
   */
  async signOut(): Promise<void> {
    const supabase = await this.getServerClient();
    await supabase.auth.signOut();
  }

  /**
   * Get user by ID
   */
  async getUser(userId: string): Promise<User | null> {
    return this.userRepository.getUser(userId);
  }

  /**
   * Update user
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    await this.userRepository.updateUser(userId, updates);
  }

  /**
   * Delete user
   */
  async deleteUser(userId: string): Promise<void> {
    // Delete from auth.users (CASCADE will delete from user_profiles)
    const { error } = await this.serviceRoleClient.auth.admin.deleteUser(userId);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  /**
   * Get all users
   */
  async getAllUsers(): Promise<User[]> {
    return this.userRepository.listUsers();
  }

  /**
   * Map Supabase auth user + profile to domain User object
   */
  private mapToUser(authUser: any, profile: any): User {
    return {
      id: authUser.id,
      email: authUser.email,
      role: profile.role as UserRole,
      namespaceId: profile.namespace_id,
      displayName: profile.display_name || undefined,
      createdAt: new Date(authUser.created_at),
      lastLoginAt: profile.last_login_at ? new Date(profile.last_login_at) : undefined,
      emailConfirmed: authUser.email_confirmed_at != null,
    };
  }
}
