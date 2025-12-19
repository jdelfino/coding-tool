/**
 * Unit tests for join code generation utilities
 * 
 * Tests the join code generation and validation functions to ensure
 * codes are properly formatted, use valid characters, and are random.
 */

import { generateJoinCode, isValidJoinCodeFormat } from '../join-code-service';

describe('Join Code Service', () => {
  describe('generateJoinCode', () => {
    it('should generate code in correct format (XXX-XXX-XXX)', () => {
      const code = generateJoinCode();
      
      expect(code).toMatch(/^[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}$/);
      expect(code.length).toBe(11); // 9 characters + 2 dashes
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
      const allowedChars = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789-]+$/;
      
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

    it('should have proper structure with dashes in correct positions', () => {
      const code = generateJoinCode();
      const parts = code.split('-');
      
      expect(parts).toHaveLength(3);
      expect(parts[0].length).toBe(3);
      expect(parts[1].length).toBe(3);
      expect(parts[2].length).toBe(3);
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
      
      // Check middle segment varies
      const middleSegments = new Set(codes.map(c => c.substring(4, 7)));
      expect(middleSegments.size).toBeGreaterThan(10);
    });
  });

  describe('isValidJoinCodeFormat', () => {
    it('should accept valid join code format', () => {
      expect(isValidJoinCodeFormat('ABC-123-XYZ')).toBe(true);
      expect(isValidJoinCodeFormat('XYZ-789-ABC')).toBe(true);
      expect(isValidJoinCodeFormat('AAA-BBB-CCC')).toBe(true);
      expect(isValidJoinCodeFormat('222-333-444')).toBe(true);
    });

    it('should accept lowercase and trim whitespace', () => {
      expect(isValidJoinCodeFormat('abc-123-xyz')).toBe(true);
      expect(isValidJoinCodeFormat('  ABC-123-XYZ  ')).toBe(true);
      expect(isValidJoinCodeFormat(' abc-def-ghi ')).toBe(true);
    });

    it('should reject invalid formats', () => {
      expect(isValidJoinCodeFormat('ABC123XYZ')).toBe(false); // No dashes
      expect(isValidJoinCodeFormat('AB-123-XYZ')).toBe(false); // First segment too short
      expect(isValidJoinCodeFormat('ABC-12-XYZ')).toBe(false); // Middle segment too short
      expect(isValidJoinCodeFormat('ABC-123-XY')).toBe(false); // Last segment too short
      expect(isValidJoinCodeFormat('ABCD-123-XYZ')).toBe(false); // First segment too long
      expect(isValidJoinCodeFormat('ABC-1234-XYZ')).toBe(false); // Middle segment too long
      expect(isValidJoinCodeFormat('ABC-123-XYZE')).toBe(false); // Last segment too long
    });

    it('should reject codes with invalid characters', () => {
      expect(isValidJoinCodeFormat('ABC-12#-XYZ')).toBe(false);
      expect(isValidJoinCodeFormat('AB@-123-XYZ')).toBe(false);
      expect(isValidJoinCodeFormat('ABC-123-XY$')).toBe(false);
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

    it('should reject codes with wrong dash positions', () => {
      expect(isValidJoinCodeFormat('A-BC123-XYZ')).toBe(false);
      expect(isValidJoinCodeFormat('ABC1-23-XYZ')).toBe(false);
      expect(isValidJoinCodeFormat('ABC-123XY-Z')).toBe(false);
    });
  });
});
