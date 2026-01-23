/**
 * Supabase-backed membership repository implementation
 *
 * Implements membership CRUD operations using Supabase as the storage backend.
 * Memberships represent user enrollment in sections (both instructors and students).
 *
 * Supports RLS-backed access control when accessToken is provided.
 */

import { SectionMembership, SectionWithClass } from '../../classes/types';
import { IMembershipRepository } from '../../classes/interfaces';
import { User } from '../../auth/types';
import { getSupabaseClientWithAuth } from '../../supabase/client';

/**
 * Maps a database row to a SectionMembership domain object
 */
function mapRowToMembership(row: any): SectionMembership {
  return {
    id: row.id,
    userId: row.user_id,
    sectionId: row.section_id,
    role: row.role as 'instructor' | 'student',
    joinedAt: new Date(row.joined_at),
  };
}

/**
 * Maps a database row with joined section and class to SectionWithClass
 */
function mapRowToSectionWithClass(row: any): SectionWithClass {
  return {
    id: row.id,
    namespaceId: row.namespace_id,
    classId: row.class_id,
    name: row.name,
    semester: row.semester || undefined,
    joinCode: row.join_code,
    active: row.active,
    createdAt: new Date(row.created_at),
    updatedAt: new Date(row.updated_at),
    class: {
      id: row.classes?.id || row.class_id,
      name: row.classes?.name || 'Unknown',
      description: row.classes?.description || undefined,
    },
  };
}

/**
 * Maps a database row from user_profiles to User
 */
function mapRowToUser(row: any): User {
  return {
    id: row.id,
    email: row.email,
    namespaceId: row.namespace_id,
    role: row.role,
    displayName: row.display_name || undefined,
    createdAt: new Date(row.created_at),
  };
}

/**
 * Supabase implementation of IMembershipRepository
 */
export class SupabaseMembershipRepository implements IMembershipRepository {
  private initialized = false;
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection
    const supabase = getSupabaseClientWithAuth(this.accessToken);
    const { error } = await supabase.from('section_memberships').select('id').limit(1);

    if (error) {
      throw new Error(`Failed to initialize MembershipRepository: ${error.message}`);
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for Supabase client
    this.initialized = false;
  }

  async health(): Promise<boolean> {
    try {
      const supabase = getSupabaseClientWithAuth(this.accessToken);
      const { error } = await supabase.from('section_memberships').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async addMembership(membershipData: Omit<SectionMembership, 'id' | 'joinedAt'>): Promise<SectionMembership> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    const now = new Date();
    const id = crypto.randomUUID();

    const dbData = {
      id,
      user_id: membershipData.userId,
      section_id: membershipData.sectionId,
      role: membershipData.role,
      joined_at: now.toISOString(),
    };

    const { data, error } = await supabase
      .from('section_memberships')
      .insert(dbData)
      .select()
      .single();

    if (error) {
      // Handle unique constraint violation
      if (error.code === '23505') {
        throw new Error(`User ${membershipData.userId} is already enrolled in section ${membershipData.sectionId}`);
      }
      throw new Error(`Failed to add membership: ${error.message}`);
    }

    return mapRowToMembership(data);
  }

  async removeMembership(userId: string, sectionId: string): Promise<void> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    const result = await supabase
      .from('section_memberships')
      .delete()
      .eq('user_id', userId)
      .eq('section_id', sectionId);

    if (result.error) {
      throw new Error(`Failed to remove membership: ${result.error.message}`);
    }
  }

  async getUserSections(userId: string, namespaceId?: string, role?: 'instructor' | 'student'): Promise<SectionWithClass[]> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // Join memberships → sections → classes
    let query = supabase
      .from('section_memberships')
      .select(`
        sections!inner (
          id,
          namespace_id,
          class_id,
          name,
          semester,
          instructor_ids,
          join_code,
          active,
          created_at,
          updated_at,
          classes!inner (
            id,
            name,
            description
          )
        )
      `)
      .eq('user_id', userId);

    // Apply role filter if provided
    if (role) {
      query = query.eq('role', role);
    }

    // Apply namespace filter if provided
    if (namespaceId) {
      query = query.eq('sections.namespace_id', namespaceId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get user sections: ${error.message}`);
    }

    // Map the nested structure
    return (data || []).map(row => {
      const section = (row as any).sections;
      return mapRowToSectionWithClass({
        ...section,
        classes: section.classes,
      });
    });
  }

  async getSectionMembers(sectionId: string, role?: 'instructor' | 'student'): Promise<User[]> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // Join memberships → user_profiles
    let query = supabase
      .from('section_memberships')
      .select(`
        user_profiles!inner (
          id,
          namespace_id,
          role,
          display_name,
          created_at
        )
      `)
      .eq('section_id', sectionId);

    // Apply role filter if provided
    if (role) {
      query = query.eq('role', role);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get section members: ${error.message}`);
    }

    // Map the nested structure
    return (data || []).map(row => {
      const user = (row as any).user_profiles;
      return mapRowToUser(user);
    });
  }

  async isMember(userId: string, sectionId: string): Promise<boolean> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    const { data, error } = await supabase
      .from('section_memberships')
      .select('id')
      .eq('user_id', userId)
      .eq('section_id', sectionId)
      .single();

    if (error) {
      // Not found is expected
      if (error.code === 'PGRST116') {
        return false;
      }
      throw new Error(`Failed to check membership: ${error.message}`);
    }

    return !!data;
  }

  async getMembership(userId: string, sectionId: string): Promise<SectionMembership | null> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    const { data, error } = await supabase
      .from('section_memberships')
      .select('*')
      .eq('user_id', userId)
      .eq('section_id', sectionId)
      .single();

    if (error) {
      // Not found is expected
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get membership: ${error.message}`);
    }

    return data ? mapRowToMembership(data) : null;
  }
}
