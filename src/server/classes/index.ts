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
import { ClassRepository } from './class-repository';
import { SectionRepository } from './section-repository';
import { MembershipRepository } from './membership-repository';

let classRepositoryInstance: ClassRepository | null = null;
let sectionRepositoryInstance: SectionRepository | null = null;
let membershipRepositoryInstance: MembershipRepository | null = null;

export async function getClassRepository(): Promise<ClassRepository> {
  if (!classRepositoryInstance) {
    const storage = await getStorage();
    // Use the class repository from storage backend
    classRepositoryInstance = storage.classes as ClassRepository;
  }
  return classRepositoryInstance;
}

export async function getSectionRepository(): Promise<SectionRepository> {
  if (!sectionRepositoryInstance) {
    const storage = await getStorage();
    // Use the section repository from storage backend
    sectionRepositoryInstance = storage.sections as SectionRepository;
  }
  return sectionRepositoryInstance;
}

export async function getMembershipRepository(): Promise<MembershipRepository> {
  if (!membershipRepositoryInstance) {
    const storage = await getStorage();
    // Use the membership repository from storage backend
    membershipRepositoryInstance = storage.memberships as MembershipRepository;
  }
  return membershipRepositoryInstance;
}
