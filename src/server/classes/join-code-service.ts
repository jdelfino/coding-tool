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
 * Format: ABC123 (6 characters)
 * Uses crypto.randomBytes for cryptographically secure randomness
 *
 * @returns A join code string
 */
export function generateJoinCode(): string {
  let code = '';

  for (let i = 0; i < 6; i++) {
    const randomByte = crypto.randomBytes(1)[0];
    const index = randomByte % CHARSET.length;
    code += CHARSET[index];
  }

  return code;
}

/**
 * Validate join code format
 *
 * @param code - The join code to validate
 * @returns true if format is valid (6 chars ABC123 or 11 chars ABC-123-XYZ)
 */
export function isValidJoinCodeFormat(code: string): boolean {
  if (!code || typeof code !== 'string') {
    return false;
  }

  const normalizedCode = code.trim().toUpperCase();
  // Accept both old format (6 chars) and new format (ABC-123-XYZ)
  return /^[A-Z2-9]{6}$/.test(normalizedCode) || /^[A-Z]{3}-[0-9]{3}-[A-Z]{3}$/.test(normalizedCode);
}
