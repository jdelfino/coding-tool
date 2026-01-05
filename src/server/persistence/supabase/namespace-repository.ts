/**
 * Supabase-backed namespace repository implementation
 *
 * Implements namespace CRUD operations using Supabase as the storage backend.
 * Namespaces represent organizations/tenants in the multi-tenant system.
 */

import { Namespace } from '../../auth/types';
import { INamespaceRepository } from '../../auth/interfaces';
import { getSupabaseClient } from '../../supabase/client';

/**
 * Validates a namespace ID format.
 * Must be 3-32 characters, lowercase, alphanumeric, and hyphens only.
 *
 * @param id - Namespace ID to validate
 * @returns True if valid, false otherwise
 */
export function isValidNamespaceId(id: string): boolean {
  if (!id || typeof id !== 'string') {
    return false;
  }

  // Check length
  if (id.length < 3 || id.length > 32) {
    return false;
  }

  // Check format: lowercase alphanumeric and hyphens only
  const validPattern = /^[a-z0-9-]+$/;
  if (!validPattern.test(id)) {
    return false;
  }

  // Cannot start or end with hyphen
  if (id.startsWith('-') || id.endsWith('-')) {
    return false;
  }

  // Cannot have consecutive hyphens
  if (id.includes('--')) {
    return false;
  }

  return true;
}

/**
 * Maps a database row to a Namespace domain object
 */
function mapRowToNamespace(row: any): Namespace {
  return {
    id: row.id,
    displayName: row.display_name,
    active: row.active,
    createdAt: new Date(row.created_at),
    createdBy: row.created_by,
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Supabase implementation of INamespaceRepository
 */
export class SupabaseNamespaceRepository implements INamespaceRepository {
  private initialized = false;

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection
    const supabase = getSupabaseClient();
    const { error } = await supabase.from('namespaces').select('id').limit(1);

    if (error) {
      throw new Error(`Failed to initialize NamespaceRepository: ${error.message}`);
    }

    this.initialized = true;
  }

  async createNamespace(namespace: Namespace): Promise<Namespace> {
    if (!isValidNamespaceId(namespace.id)) {
      throw new Error(
        `Invalid namespace ID: ${namespace.id}. Must be 3-32 characters, lowercase, alphanumeric, and hyphens only.`
      );
    }

    const supabase = getSupabaseClient();

    const now = new Date();
    const namespaceData = {
      id: namespace.id,
      display_name: namespace.displayName,
      active: namespace.active !== undefined ? namespace.active : true,
      created_by: namespace.createdBy,
      created_at: (namespace.createdAt || now).toISOString(),
      updated_at: (namespace.updatedAt || now).toISOString(),
    };

    const { data, error } = await supabase
      .from('namespaces')
      .insert(namespaceData)
      .select()
      .single();

    if (error) {
      if (error.code === '23505') { // Unique violation
        throw new Error(`Namespace already exists: ${namespace.id}`);
      }
      throw new Error(`Failed to create namespace: ${error.message}`);
    }

    return mapRowToNamespace(data);
  }

  async getNamespace(id: string): Promise<Namespace | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('namespaces')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') { // Not found
        return null;
      }
      throw new Error(`Failed to get namespace: ${error.message}`);
    }

    return data ? mapRowToNamespace(data) : null;
  }

  async listNamespaces(includeInactive = false): Promise<Namespace[]> {
    const supabase = getSupabaseClient();

    let query = supabase.from('namespaces').select('*');

    if (!includeInactive) {
      query = query.eq('active', true);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list namespaces: ${error.message}`);
    }

    return data.map(mapRowToNamespace);
  }

  async updateNamespace(id: string, updates: Partial<Namespace>): Promise<void> {
    const supabase = getSupabaseClient();

    // Map domain fields to database columns
    const updateData: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.displayName !== undefined) {
      updateData.display_name = updates.displayName;
    }
    if (updates.active !== undefined) {
      updateData.active = updates.active;
    }
    if (updates.createdBy !== undefined) {
      updateData.created_by = updates.createdBy;
    }

    const { error } = await supabase
      .from('namespaces')
      .update(updateData)
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to update namespace: ${error.message}`);
    }
  }

  async deleteNamespace(id: string): Promise<void> {
    const supabase = getSupabaseClient();

    // Soft delete: set active = false
    const { error } = await supabase
      .from('namespaces')
      .update({
        active: false,
        updated_at: new Date().toISOString(),
      })
      .eq('id', id);

    if (error) {
      throw new Error(`Failed to delete namespace: ${error.message}`);
    }
  }

  async namespaceExists(id: string): Promise<boolean> {
    const namespace = await this.getNamespace(id);
    return namespace !== null;
  }
}
