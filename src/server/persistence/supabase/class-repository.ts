/**
 * Supabase-backed class repository implementation
 *
 * Implements class CRUD operations using Supabase as the storage backend.
 * Classes represent course offerings (e.g., CS 101, Data Structures) in the system.
 *
 * Supports RLS-backed access control when accessToken is provided.
 */

import { Class, Section } from '../../classes/types';
import { IClassRepository } from '../../classes/interfaces';
import { getClient } from '../../supabase/client';

/**
 * Maps a database row to a Class domain object
 */
function mapRowToClass(row: any): Class {
  return {
    id: row.id,
    namespaceId: row.namespace_id,
    name: row.name,
    description: row.description || undefined,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Maps a database row to a Section domain object
 */
function mapRowToSection(row: any): Section {
  return {
    id: row.id,
    namespaceId: row.namespace_id,
    classId: row.class_id,
    name: row.name,
    semester: row.semester || undefined,
    instructorIds: row.instructor_ids || [],
    joinCode: row.join_code,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
  };
}

/**
 * Supabase implementation of IClassRepository
 */
export class SupabaseClassRepository implements IClassRepository {
  private initialized = false;
  private readonly accessToken?: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection
    const supabase = getClient(this.accessToken);
    const { error } = await supabase.from('classes').select('id').limit(1);

    if (error) {
      throw new Error(`Failed to initialize ClassRepository: ${error.message}`);
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for Supabase client
    this.initialized = false;
  }

  async health(): Promise<boolean> {
    try {
      const supabase = getClient(this.accessToken);
      const { error } = await supabase.from('classes').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async createClass(classData: Omit<Class, 'id' | 'createdAt' | 'updatedAt'>): Promise<Class> {
    const supabase = getClient(this.accessToken);

    const now = new Date();
    const id = crypto.randomUUID();

    const dbData = {
      id,
      namespace_id: classData.namespaceId,
      name: classData.name,
      description: classData.description || null,
      created_by: classData.createdBy,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const { data, error } = await supabase
      .from('classes')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create class: ${error.message}`);
    }

    return mapRowToClass(data);
  }

  async getClass(classId: string, namespaceId?: string): Promise<Class | null> {
    const supabase = getClient(this.accessToken);

    let query = supabase
      .from('classes')
      .select('*')
      .eq('id', classId);

    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    }

    const { data, error } = await query.single();

    if (error) {
      // Not found is expected, other errors are not
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get class: ${error.message}`);
    }

    return data ? mapRowToClass(data) : null;
  }

  async updateClass(classId: string, updates: Partial<Omit<Class, 'id' | 'createdAt'>>): Promise<void> {
    const supabase = getClient(this.accessToken);

    // Map domain fields to database columns
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.namespaceId !== undefined) dbUpdates.namespace_id = updates.namespaceId;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.description !== undefined) dbUpdates.description = updates.description || null;
    if (updates.createdBy !== undefined) dbUpdates.created_by = updates.createdBy;
    if (updates.updatedAt !== undefined) dbUpdates.updated_at = updates.updatedAt.toISOString();

    const { error } = await supabase
      .from('classes')
      .update(dbUpdates)
      .eq('id', classId);

    if (error) {
      throw new Error(`Failed to update class: ${error.message}`);
    }
  }

  async deleteClass(classId: string): Promise<void> {
    const supabase = getClient(this.accessToken);

    const { error } = await supabase
      .from('classes')
      .delete()
      .eq('id', classId);

    if (error) {
      throw new Error(`Failed to delete class: ${error.message}`);
    }
  }

  async listClasses(createdBy?: string, namespaceId?: string): Promise<Class[]> {
    const supabase = getClient(this.accessToken);

    let query = supabase.from('classes').select('*');

    if (createdBy) {
      query = query.eq('created_by', createdBy);
    }

    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list classes: ${error.message}`);
    }

    return data ? data.map(mapRowToClass) : [];
  }

  async getClassSections(classId: string, namespaceId?: string): Promise<Section[]> {
    const supabase = getClient(this.accessToken);

    let query = supabase
      .from('sections')
      .select('*')
      .eq('class_id', classId);

    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get class sections: ${error.message}`);
    }

    return data ? data.map(mapRowToSection) : [];
  }
}
