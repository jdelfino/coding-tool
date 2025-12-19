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

export function getClassRepository(): ClassRepository {
  if (!classRepositoryInstance) {
    const storage = getStorage();
    classRepositoryInstance = new ClassRepository(storage);
    // Wire up dependencies
    classRepositoryInstance.setSectionRepository(getSectionRepository());
  }
  return classRepositoryInstance;
}

export function getSectionRepository(): SectionRepository {
  if (!sectionRepositoryInstance) {
    const storage = getStorage();
    sectionRepositoryInstance = new SectionRepository(storage);
  }
  return sectionRepositoryInstance;
}

export function getMembershipRepository(): MembershipRepository {
  if (!membershipRepositoryInstance) {
    const storage = getStorage();
    membershipRepositoryInstance = new MembershipRepository(storage);
    // Wire up dependencies
    const { getUserRepository } = require('../auth');
    membershipRepositoryInstance.setRepositories(getUserRepository(), getSectionRepository(), getClassRepository());
  }
  return membershipRepositoryInstance;
}
