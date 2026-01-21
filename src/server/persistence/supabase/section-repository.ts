/**
 * Supabase-backed section repository implementation
 *
 * Implements section CRUD operations using Supabase as the storage backend.
 * Sections represent specific offerings of classes (e.g., Fall 2025 - Section A).
 *
 * Supports RLS-backed access control when accessToken is provided:
 * - With accessToken: Uses authenticated client, RLS policies enforce access
 * - Without accessToken: Uses service_role client, bypasses RLS (admin operations)
 */

import { Section, SectionFilters, SectionStats } from '../../classes/types';
import { ISectionRepository } from '../../classes/interfaces';
import { getClient } from '../../supabase/client';
import { generateJoinCode, normalizeJoinCode } from '../../classes/join-code-service';

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
 * Supabase implementation of ISectionRepository
 *
 * @param accessToken - Optional JWT access token. If provided, RLS policies apply.
 *                      If not provided, uses service_role client (for admin operations).
 */
export class SupabaseSectionRepository implements ISectionRepository {
  private initialized = false;
  private readonly accessToken?: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection
    const supabase = getClient(this.accessToken);
    const { error } = await supabase.from('sections').select('id').limit(1);

    if (error) {
      throw new Error(`Failed to initialize SectionRepository: ${error.message}`);
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
      const { error } = await supabase.from('sections').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async createSection(sectionData: Omit<Section, 'id' | 'joinCode' | 'createdAt' | 'updatedAt'>): Promise<Section> {
    const supabase = getClient(this.accessToken);

    const now = new Date();
    const id = crypto.randomUUID();
    
    // Generate a unique join code
    let joinCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      joinCode = generateJoinCode();
      
      // Check if join code already exists
      const { data: existing } = await supabase
        .from('sections')
        .select('id')
        .eq('join_code', joinCode)
        .single();
      
      if (!existing) {
        break;
      }
      
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique join code after maximum attempts');
    }

    const dbData = {
      id,
      namespace_id: sectionData.namespaceId,
      class_id: sectionData.classId,
      name: sectionData.name,
      semester: sectionData.semester || null,
      instructor_ids: sectionData.instructorIds || [],
      join_code: joinCode!,
      active: sectionData.active ?? true,
      created_at: now.toISOString(),
      updated_at: now.toISOString(),
    };

    const { data, error } = await supabase
      .from('sections')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create section: ${error.message}`);
    }

    return mapRowToSection(data);
  }

  async getSection(sectionId: string, namespaceId?: string): Promise<Section | null> {
    const supabase = getClient(this.accessToken);

    let query = supabase
      .from('sections')
      .select('*')
      .eq('id', sectionId);

    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    }

    const { data, error } = await query.single();

    if (error) {
      // Not found is expected, other errors are not
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get section: ${error.message}`);
    }

    return data ? mapRowToSection(data) : null;
  }

  async getSectionByJoinCode(joinCode: string): Promise<Section | null> {
    // Normalize the input code to match stored format (removes dashes, uppercase)
    const normalizedCode = normalizeJoinCode(joinCode);
    if (!normalizedCode) {
      return null;
    }

    const supabase = getClient(this.accessToken);

    const { data, error } = await supabase
      .from('sections')
      .select('*')
      .eq('join_code', normalizedCode)
      .single();

    if (error) {
      // Not found is expected, other errors are not
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get section by join code: ${error.message}`);
    }

    return data ? mapRowToSection(data) : null;
  }

  async updateSection(sectionId: string, updates: Partial<Omit<Section, 'id' | 'createdAt'>>): Promise<void> {
    const supabase = getClient(this.accessToken);

    // Map domain fields to database columns
    const dbUpdates: any = {
      updated_at: new Date().toISOString(),
    };

    if (updates.namespaceId !== undefined) dbUpdates.namespace_id = updates.namespaceId;
    if (updates.classId !== undefined) dbUpdates.class_id = updates.classId;
    if (updates.name !== undefined) dbUpdates.name = updates.name;
    if (updates.semester !== undefined) dbUpdates.semester = updates.semester || null;
    if (updates.instructorIds !== undefined) dbUpdates.instructor_ids = updates.instructorIds;
    if (updates.joinCode !== undefined) dbUpdates.join_code = updates.joinCode;
    if (updates.active !== undefined) dbUpdates.active = updates.active;
    if (updates.updatedAt !== undefined) dbUpdates.updated_at = updates.updatedAt.toISOString();

    const { error } = await supabase
      .from('sections')
      .update(dbUpdates)
      .eq('id', sectionId);

    if (error) {
      throw new Error(`Failed to update section: ${error.message}`);
    }
  }

  async deleteSection(sectionId: string): Promise<void> {
    const supabase = getClient(this.accessToken);

    const { error } = await supabase
      .from('sections')
      .delete()
      .eq('id', sectionId);

    if (error) {
      throw new Error(`Failed to delete section: ${error.message}`);
    }
  }

  async listSections(filters?: SectionFilters, namespaceId?: string): Promise<Section[]> {
    const supabase = getClient(this.accessToken);

    let query = supabase.from('sections').select('*');

    if (filters?.classId) {
      query = query.eq('class_id', filters.classId);
    }

    if (filters?.instructorId) {
      query = query.contains('instructor_ids', [filters.instructorId]);
    }

    if (filters?.active !== undefined) {
      query = query.eq('active', filters.active);
    }

    const finalNamespaceId = namespaceId || filters?.namespaceId;
    if (finalNamespaceId) {
      query = query.eq('namespace_id', finalNamespaceId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list sections: ${error.message}`);
    }

    return data ? data.map(mapRowToSection) : [];
  }

  async regenerateJoinCode(sectionId: string): Promise<string> {
    const supabase = getClient(this.accessToken);

    // Generate a new unique join code
    let newJoinCode: string;
    let attempts = 0;
    const maxAttempts = 10;

    while (attempts < maxAttempts) {
      newJoinCode = generateJoinCode();
      
      // Check if join code already exists
      const { data: existing } = await supabase
        .from('sections')
        .select('id')
        .eq('join_code', newJoinCode)
        .single();
      
      if (!existing) {
        break;
      }
      
      attempts++;
    }

    if (attempts >= maxAttempts) {
      throw new Error('Failed to generate unique join code after maximum attempts');
    }

    // Update the section with the new join code
    const { error } = await supabase
      .from('sections')
      .update({ 
        join_code: newJoinCode!,
        updated_at: new Date().toISOString()
      })
      .eq('id', sectionId);

    if (error) {
      throw new Error(`Failed to regenerate join code: ${error.message}`);
    }

    return newJoinCode!;
  }

  async addInstructor(sectionId: string, instructorId: string): Promise<void> {
    const supabase = getClient(this.accessToken);

    // Get current section
    const section = await this.getSection(sectionId);
    if (!section) {
      throw new Error(`Section ${sectionId} not found`);
    }

    // Check if instructor already exists
    if (section.instructorIds.includes(instructorId)) {
      return; // Idempotent - no change needed
    }

    // Add instructor to the array
    const updatedInstructorIds = [...section.instructorIds, instructorId];

    const { error } = await supabase
      .from('sections')
      .update({ 
        instructor_ids: updatedInstructorIds,
        updated_at: new Date().toISOString()
      })
      .eq('id', sectionId);

    if (error) {
      throw new Error(`Failed to add instructor: ${error.message}`);
    }
  }

  async removeInstructor(sectionId: string, instructorId: string): Promise<void> {
    const supabase = getClient(this.accessToken);

    // Get current section
    const section = await this.getSection(sectionId);
    if (!section) {
      throw new Error(`Section ${sectionId} not found`);
    }

    // Remove instructor from the array
    const updatedInstructorIds = section.instructorIds.filter(id => id !== instructorId);

    // If no change, return early (idempotent)
    if (updatedInstructorIds.length === section.instructorIds.length) {
      return;
    }

    const { error } = await supabase
      .from('sections')
      .update({ 
        instructor_ids: updatedInstructorIds,
        updated_at: new Date().toISOString()
      })
      .eq('id', sectionId);

    if (error) {
      throw new Error(`Failed to remove instructor: ${error.message}`);
    }
  }

  async getSectionStats(sectionId: string): Promise<SectionStats> {
    const supabase = getClient(this.accessToken);

    // Count students in section_memberships table
    const { count: studentCount, error: studentError } = await supabase
      .from('section_memberships')
      .select('*', { count: 'exact', head: true })
      .eq('section_id', sectionId)
      .eq('role', 'student');

    if (studentError) {
      throw new Error(`Failed to count students: ${studentError.message}`);
    }

    // Count total sessions for this section
    const { count: sessionCount, error: sessionError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('section_id', sectionId);

    if (sessionError) {
      throw new Error(`Failed to count sessions: ${sessionError.message}`);
    }

    // Count active sessions for this section
    const { count: activeSessionCount, error: activeSessionError } = await supabase
      .from('sessions')
      .select('*', { count: 'exact', head: true })
      .eq('section_id', sectionId)
      .eq('status', 'active');

    if (activeSessionError) {
      throw new Error(`Failed to count active sessions: ${activeSessionError.message}`);
    }

    return {
      studentCount: studentCount || 0,
      sessionCount: sessionCount || 0,
      activeSessionCount: activeSessionCount || 0,
    };
  }
}
