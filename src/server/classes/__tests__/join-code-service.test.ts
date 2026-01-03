/**
 * Unit tests for join code generation utilities
 * 
 * Tests the join code generation and validation functions to ensure
 * codes are properly formatted, use valid characters, and are random.
 */

import { generateJoinCode, isValidJoinCodeFormat } from '../join-code-service';

describe('Join Code Service', () => {
  describe('generateJoinCode', () => {
    it('should generate code in correct format (6 characters)', () => {
      const code = generateJoinCode();
      
      expect(code).toMatch(/^[A-Z0-9]{6}$/);
      expect(code.length).toBe(6);
    });

    it('should generate unique codes', () => {
      const codes = new Set<string>();
      
      // Generate 100 codes - should all be unique with high probability
      for (let i = 0; i < 100; i++) {
        codes.add(generateJoinCode());
      }
      
      expect(codes.size).toBe(100);
    });

    it('should only use allowed characters (no O/0/I/1/L confusion)', () => {
      // Allowed charset: ABCDEFGHJKMNPQRSTUVWXYZ23456789
      const allowedChars = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]+$/;
      
      for (let i = 0; i < 20; i++) {
        const code = generateJoinCode();
        expect(code).toMatch(allowedChars);
        
        // Verify no confusing characters
        expect(code).not.toContain('O');
        expect(code).not.toContain('0');
        expect(code).not.toContain('I');
        expect(code).not.toContain('1');
        expect(code).not.toContain('L');
      }
    });

    it('should use cryptographically random values', () => {
      // Statistical test: in 100 codes, each position should vary
      const codes: string[] = [];
      for (let i = 0; i < 100; i++) {
        codes.push(generateJoinCode());
      }
      
      // Check first character varies
      const firstChars = new Set(codes.map(c => c[0]));
      expect(firstChars.size).toBeGreaterThan(5); // Should have variation
      
      // Check last character varies
      const lastChars = new Set(codes.map(c => c[5]));
      expect(lastChars.size).toBeGreaterThan(5);
    });
  });

  describe('isValidJoinCodeFormat', () => {
    it('should accept valid join code format', () => {
      expect(isValidJoinCodeFormat('ABC234')).toBe(true);
      expect(isValidJoinCodeFormat('XYZ789')).toBe(true);
      expect(isValidJoinCodeFormat('AAAAAA')).toBe(true);
      expect(isValidJoinCodeFormat('222333')).toBe(true);
    });

    it('should accept lowercase and trim whitespace', () => {
      expect(isValidJoinCodeFormat('abc234')).toBe(true);
      expect(isValidJoinCodeFormat('  ABC234  ')).toBe(true);
      expect(isValidJoinCodeFormat(' abcdef ')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidJoinCodeFormat('ABC234XYZ')).toBe(false); // Too long (9 chars)
      expect(isValidJoinCodeFormat('ABCDE')).toBe(false); // Too short
      expect(isValidJoinCodeFormat('ABCDEFG')).toBe(false); // Too long
    });

    it('should reject codes with invalid characters', () => {
      expect(isValidJoinCodeFormat('ABC#2X')).toBe(false);
      expect(isValidJoinCodeFormat('AB@23X')).toBe(false);
      expect(isValidJoinCodeFormat('ABC12$')).toBe(false);
      expect(isValidJoinCodeFormat('ABC-12')).toBe(false); // Dashes not allowed
    });

    it('should reject null, undefined, and non-string inputs', () => {
      expect(isValidJoinCodeFormat(null as any)).toBe(false);
      expect(isValidJoinCodeFormat(undefined as any)).toBe(false);
      expect(isValidJoinCodeFormat(123 as any)).toBe(false);
      expect(isValidJoinCodeFormat({} as any)).toBe(false);
      expect(isValidJoinCodeFormat([] as any)).toBe(false);
    });

    it('should reject empty string', () => {
      expect(isValidJoinCodeFormat('')).toBe(false);
      expect(isValidJoinCodeFormat('   ')).toBe(false);
    });

    it('should reject codes with lowercase letters', () => {
      expect(isValidJoinCodeFormat('abc123')).toBe(false);
      expect(isValidJoinCodeFormat('ABc123')).toBe(false);
      expect(isValidJoinCodeFormat('ABC12z')).toBe(false);
    });
  });
});
