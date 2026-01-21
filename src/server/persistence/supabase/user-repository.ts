/**
 * Supabase-backed user repository implementation
 *
 * Implements user CRUD operations using Supabase as the storage backend.
 * Users are stored in user_profiles table which extends auth.users.
 *
 * Supports RLS-backed access control when accessToken is provided.
 */

import { User, UserRole } from '../../auth/types';
import { IUserRepository } from '../../auth/interfaces';
import { getSupabaseClientWithAuth } from '../../supabase/client';

/**
 * Maps a database row to a User domain object
 */
function mapRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    role: row.role as UserRole,
    namespaceId: row.namespace_id,
    displayName: row.display_name || undefined,
    createdAt: new Date(row.created_at),
    lastLoginAt: row.last_login_at ? new Date(row.last_login_at) : undefined,
    emailConfirmed: row.email_confirmed,
  };
}

/**
 * Supabase implementation of IUserRepository
 */
export class SupabaseUserRepository implements IUserRepository {
  private initialized = false;
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection
    const supabase = getSupabaseClientWithAuth(this.accessToken);
    const { error } = await supabase.from('user_profiles').select('id').limit(1);

    if (error) {
      throw new Error(`Failed to initialize UserRepository: ${error.message}`);
    }

    this.initialized = true;
  }

  async saveUser(user: User): Promise<void> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // Prepare user data for database
    const userData = {
      id: user.id,
      role: user.role,
      namespace_id: user.namespaceId,
      display_name: user.displayName || null,
      created_at: user.createdAt.toISOString(),
      last_login_at: user.lastLoginAt?.toISOString() || null,
    };

    // Try to insert, if conflict update
    const { error } = await supabase.from('user_profiles').upsert(userData as any, {
      onConflict: 'id',
    });

    if (error) {
      throw new Error(`Failed to save user: ${error.message}`);
    }
  }

  async getUser(userId: string): Promise<User | null> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('id', userId)
      .single();

    if (error) {
      // Not found is expected, other errors are not
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get user: ${error.message}`);
    }

    return data ? mapRowToUser(data) : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // Email is stored in auth.users, so we need to query via the join
    // The email field is available in the user_profiles view/query if joined
    const { data, error } = await supabase
      .from('user_profiles')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      // Not found is expected, other errors are not
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get user by email: ${error.message}`);
    }

    return data ? mapRowToUser(data) : null;
  }

  async listUsers(role?: UserRole, namespaceId?: string | null): Promise<User[]> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    let query = supabase.from('user_profiles').select('*');

    // Apply filters if provided
    if (role) {
      query = query.eq('role', role);
    }

    if (namespaceId !== undefined) {
      if (namespaceId === null) {
        query = query.is('namespace_id', null);
      } else {
        query = query.eq('namespace_id', namespaceId);
      }
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

    return data ? data.map(mapRowToUser) : [];
  }

  async getUsersByNamespace(namespaceId: string): Promise<User[]> {
    return this.listUsers(undefined, namespaceId);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // Map User fields to database columns
    const dbUpdates: any = {};

    if (updates.role !== undefined) dbUpdates.role = updates.role;
    if (updates.namespaceId !== undefined) dbUpdates.namespace_id = updates.namespaceId;
    if (updates.displayName !== undefined) dbUpdates.display_name = updates.displayName;
    if (updates.lastLoginAt !== undefined) {
      dbUpdates.last_login_at = updates.lastLoginAt?.toISOString() || null;
    }

    const { error } = await supabase
      .from('user_profiles')
      .update(dbUpdates)
      .eq('id', userId);

    if (error) {
      throw new Error(`Failed to update user: ${error.message}`);
    }
  }

  async deleteUser(userId: string): Promise<void> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    const { error } = await supabase.from('user_profiles').delete().eq('id', userId);

    if (error) {
      throw new Error(`Failed to delete user: ${error.message}`);
    }
  }

  async health(): Promise<boolean> {
    try {
      const supabase = getSupabaseClientWithAuth(this.accessToken);
      const { error } = await supabase.from('user_profiles').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for Supabase client
    this.initialized = false;
  }
}
