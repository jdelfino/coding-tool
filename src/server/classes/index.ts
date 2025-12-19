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
export { ClassRepository } from './class-repository';
export { SectionRepository } from './section-repository';
export { MembershipRepository } from './membership-repository';
export { generateJoinCode, isValidJoinCodeFormat } from './join-code-service';

// Singleton instances
import { getStorage } from '../persistence';
import type { IClassRepository, ISectionRepository, IMembershipRepository } from './interfaces';

let classRepositoryInstance: IClassRepository | null = null;
let sectionRepositoryInstance: ISectionRepository | null = null;
let membershipRepositoryInstance: IMembershipRepository | null = null;

export async function getClassRepository(): Promise<IClassRepository> {
  if (!classRepositoryInstance) {
    const storage = await getStorage();
    if (!storage.classes) {
      throw new Error('Class repository not initialized in storage backend');
    }
    classRepositoryInstance = storage.classes;
  }
  return classRepositoryInstance;
}

export async function getSectionRepository(): Promise<ISectionRepository> {
  if (!sectionRepositoryInstance) {
    const storage = await getStorage();
    if (!storage.sections) {
      throw new Error('Section repository not initialized in storage backend');
    }
    sectionRepositoryInstance = storage.sections;
  }
  return sectionRepositoryInstance;
}

export async function getMembershipRepository(): Promise<IMembershipRepository> {
  if (!membershipRepositoryInstance) {
    const storage = await getStorage();
    if (!storage.memberships) {
      throw new Error('Membership repository not initialized in storage backend');
    }
    membershipRepositoryInstance = storage.memberships;
  }
  return membershipRepositoryInstance;
}
