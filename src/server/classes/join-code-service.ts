/**
 * Join code generator utility
 * 
 * Simple stateless utility for generating unique, readable join codes.
 * No dependencies - just pure code generation.
 */

import * as crypto from 'crypto';

/**
 * Characters to use in join codes
 * Excludes ambiguous characters: O/0, I/1, L/l
 */
const CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

/**
 * Generate a unique join code
 * 
 * Format: ABC-123-XYZ (3 segments of 3 characters each)
 * Uses crypto.randomBytes for cryptographically secure randomness
 * 
 * @returns A join code string
 */
export function generateJoinCode(): string {
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
 * Validate join code format
 * 
 * @param code - The join code to validate
 * @returns true if format is valid (XXX-XXX-XXX)
 */
export function isValidJoinCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }
  
  const normalizedCode = code.trim().toUpperCase();
  return /^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/.test(normalizedCode);
}
