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
