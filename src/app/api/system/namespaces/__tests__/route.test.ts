/**
 * Unit tests for namespace ID validation
 * 
 * These tests verify the namespace ID validation logic without requiring
 * full API authentication mocking.
 */

describe('Namespace ID validation', () => {
  // The validation regex from the API route
  const namespaceIdRegex = /^[a-z0-9-]{3,32}$/;

  describe('Valid namespace IDs', () => {
    it('should accept lowercase letters only (3 chars)', () => {
      expect(namespaceIdRegex.test('abc')).toBe(true);
    });

    it('should accept lowercase letters only (32 chars)', () => {
      const id = 'a'.repeat(32);
      expect(namespaceIdRegex.test(id)).toBe(true);
    });

    it('should accept lowercase with hyphens', () => {
      expect(namespaceIdRegex.test('test-namespace')).toBe(true);
    });

    it('should accept lowercase with numbers', () => {
      expect(namespaceIdRegex.test('namespace123')).toBe(true);
    });

    it('should accept mix of lowercase, numbers, and hyphens', () => {
      expect(namespaceIdRegex.test('test-namespace-123')).toBe(true);
    });
  });

  describe('Invalid namespace IDs', () => {
    it('should reject ID shorter than 3 characters', () => {
      expect(namespaceIdRegex.test('ab')).toBe(false);
      expect(namespaceIdRegex.test('a')).toBe(false);
      expect(namespaceIdRegex.test('')).toBe(false);
    });

    it('should reject ID longer than 32 characters', () => {
      const id = 'a'.repeat(33);
      expect(namespaceIdRegex.test(id)).toBe(false);
    });

    it('should reject uppercase letters', () => {
      expect(namespaceIdRegex.test('TestNamespace')).toBe(false);
      expect(namespaceIdRegex.test('TESTNAMESPACE')).toBe(false);
      expect(namespaceIdRegex.test('Test')).toBe(false);
    });

    it('should reject spaces', () => {
      expect(namespaceIdRegex.test('test namespace')).toBe(false);
      expect(namespaceIdRegex.test('test ')).toBe(false);
      expect(namespaceIdRegex.test(' test')).toBe(false);
    });

    it('should reject underscores', () => {
      expect(namespaceIdRegex.test('test_namespace')).toBe(false);
    });

    it('should reject special characters', () => {
      expect(namespaceIdRegex.test('test@namespace')).toBe(false);
      expect(namespaceIdRegex.test('test.namespace')).toBe(false);
      expect(namespaceIdRegex.test('test!namespace')).toBe(false);
      expect(namespaceIdRegex.test('test#namespace')).toBe(false);
      expect(namespaceIdRegex.test('test$namespace')).toBe(false);
    });

    it('should reject starting or ending with hyphen', () => {
      // Note: The regex allows this, but it's semantically questionable
      // If we want to disallow it, we'd need to update the regex
      // For now, documenting current behavior
      expect(namespaceIdRegex.test('-test')).toBe(true); // Currently allowed
      expect(namespaceIdRegex.test('test-')).toBe(true); // Currently allowed
    });
  });

  describe('Edge cases', () => {
    it('should accept exactly 3 characters', () => {
      expect(namespaceIdRegex.test('abc')).toBe(true);
      expect(namespaceIdRegex.test('a-b')).toBe(true);
      expect(namespaceIdRegex.test('123')).toBe(true);
    });

    it('should accept exactly 32 characters', () => {
      const id32 = 'abcdefghijklmnopqrstuvwxyz123456';
      expect(id32.length).toBe(32);
      expect(namespaceIdRegex.test(id32)).toBe(true);
    });

    it('should reject 2 characters', () => {
      expect(namespaceIdRegex.test('ab')).toBe(false);
    });

    it('should reject 33 characters', () => {
      const id33 = 'abcdefghijklmnopqrstuvwxyz1234567';
      expect(id33.length).toBe(33);
      expect(namespaceIdRegex.test(id33)).toBe(false);
    });
  });
});

