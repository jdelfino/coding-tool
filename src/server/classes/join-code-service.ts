/**
 * Join code generation and validation service
 * 
 * Generates unique, readable join codes for sections and handles the
 * student enrollment workflow.
 */

import * as crypto from 'crypto';
import { IJoinCodeService } from './interfaces';
import { Section, SectionMembership } from './types';

/**
 * Characters to use in join codes
 * Excludes ambiguous characters: O/0, I/1, L/l
 */
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Implementation of join code service
 */
export class JoinCodeService implements IJoinCodeService {
  private sectionRepository: any; // Will be injected
  private membershipRepository: any; // Will be injected

  constructor(
    sectionRepository: any,
    membershipRepository: any
  ) {
    this.sectionRepository = sectionRepository;
    this.membershipRepository = membershipRepository;
  }

  /**
   * Generate a unique join code
   * 
   * Format: ABC-123-XYZ (3 segments of 3 characters each)
   * Uses crypto.randomBytes for cryptographically secure randomness
   * 
   * @returns A join code string
   */
  generateJoinCode(): string {
    const segments: string[] = [];
    
    for (let i = 0; i < 3; i++) {
      let segment = '';
      for (let j = 0; j < 3; j++) {
        const randomByte = crypto.randomBytes(1)[0];
        const index = randomByte % CHARSET.length;
        segment += CHARSET[index];
      }
      segments.push(segment);
    }
    
    return segments.join('-');
  }

  /**
   * Validate a join code and return the section
   * 
   * @param code - The join code to validate
   * @returns The section if code is valid and active, null otherwise
   */
  async validateJoinCode(code: string): Promise<Section | null> {
    if (!code || typeof code !== 'string') {
      return null;
    }

    // Normalize the code (uppercase, trim whitespace)
    const normalizedCode = code.trim().toUpperCase();
    
    // Validate format (XXX-XXX-XXX)
    if (!/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(normalizedCode)) {
      return null;
    }

    const section = await this.sectionRepository.getSectionByJoinCode(normalizedCode);
    
    // Return section only if it exists and is active
    if (section && section.active) {
      return section;
    }
    
    return null;
  }

  /**
   * Join a section using a join code
   * 
   * Creates a membership with role 'student'. If the user is already
   * a member, returns the existing membership (idempotent).
   * 
   * @param userId - The user ID attempting to join
   * @param joinCode - The join code for the section
   * @returns The created or existing membership
   * @throws Error if join code is invalid
   */
  async joinSection(userId: string, joinCode: string): Promise<SectionMembership> {
    // Validate the join code
    const section = await this.validateJoinCode(joinCode);
    
    if (!section) {
      throw new Error('Invalid or inactive join code');
    }

    // Check if user is already a member
    const existingMembership = await this.membershipRepository.getMembership(
      userId,
      section.id
    );

    if (existingMembership) {
      // Idempotent - return existing membership
      return existingMembership;
    }

    // Create new membership with student role
    const membership = await this.membershipRepository.addMembership({
      userId,
      sectionId: section.id,
      role: 'student',
    });

    return membership;
  }
}
