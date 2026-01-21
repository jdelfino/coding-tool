/**
 * Classes module - Multi-tenancy organizational structure
 * 
 * Provides data models and repository interfaces for organizing users
 * into classes and sections. Enables instructors to manage multiple
 * course sections and students to enroll via join codes.
 * 
 * @module server/classes
 */

// Export all types
export type {
  Class,
  Section,
  SectionMembership,
  SectionWithClass,
  SectionStats,
  SectionFilters,
} from './types';

// Export all interfaces
export type {
  IClassRepository,
  ISectionRepository,
  IMembershipRepository,
  IJoinCodeService,
} from './interfaces';

// Export implementations
export { ClassRepository } from './local';
export { SectionRepository } from './local';
export { MembershipRepository } from './local';
export { generateJoinCode, isValidJoinCodeFormat } from './join-code-service';

// Singleton instances (for backward compatibility and admin operations)
import { getStorage } from '../persistence';
import type { IClassRepository, ISectionRepository, IMembershipRepository } from './interfaces';
import {
  SupabaseClassRepository,
  SupabaseSectionRepository,
  SupabaseMembershipRepository,
} from '../persistence/supabase';

let classRepositoryInstance: IClassRepository | null = null;
let sectionRepositoryInstance: ISectionRepository | null = null;
let membershipRepositoryInstance: IMembershipRepository | null = null;

/**
 * Get class repository, optionally with RLS-backed access control.
 *
 * @param accessToken - Optional JWT access token. If provided, returns a repository
 *                      that uses RLS policies for access control (defense-in-depth).
 *                      If not provided, returns singleton with service_role client.
 */
export async function getClassRepository(accessToken?: string): Promise<IClassRepository> {
  // If accessToken provided, create a new RLS-backed instance
  if (accessToken) {
    return new SupabaseClassRepository(accessToken);
  }

  // Otherwise use singleton (service_role)
  if (!classRepositoryInstance) {
    const storage = await getStorage();
    if (!storage.classes) {
      throw new Error('Class repository not initialized in storage backend');
    }
    classRepositoryInstance = storage.classes;
  }
  return classRepositoryInstance;
}

/**
 * Get section repository, optionally with RLS-backed access control.
 *
 * @param accessToken - Optional JWT access token. If provided, returns a repository
 *                      that uses RLS policies for access control (defense-in-depth).
 *                      If not provided, returns singleton with service_role client.
 */
export async function getSectionRepository(accessToken?: string): Promise<ISectionRepository> {
  // If accessToken provided, create a new RLS-backed instance
  if (accessToken) {
    return new SupabaseSectionRepository(accessToken);
  }

  // Otherwise use singleton (service_role)
  if (!sectionRepositoryInstance) {
    const storage = await getStorage();
    if (!storage.sections) {
      throw new Error('Section repository not initialized in storage backend');
    }
    sectionRepositoryInstance = storage.sections;
  }
  return sectionRepositoryInstance;
}

/**
 * Get membership repository, optionally with RLS-backed access control.
 *
 * @param accessToken - Optional JWT access token. If provided, returns a repository
 *                      that uses RLS policies for access control (defense-in-depth).
 *                      If not provided, returns singleton with service_role client.
 */
export async function getMembershipRepository(accessToken?: string): Promise<IMembershipRepository> {
  // If accessToken provided, create a new RLS-backed instance
  if (accessToken) {
    return new SupabaseMembershipRepository(accessToken);
  }

  // Otherwise use singleton (service_role)
  if (!membershipRepositoryInstance) {
    const storage = await getStorage();
    if (!storage.memberships) {
      throw new Error('Membership repository not initialized in storage backend');
    }
    membershipRepositoryInstance = storage.memberships;
  }
  return membershipRepositoryInstance;
}
