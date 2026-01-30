/**
 * Tests for problem schema validation
 */

import { validateProblemSchema, PROBLEM_VALIDATION_RULES } from '../problem-schema';
import { Problem } from '../../types/problem';

describe('validateProblemSchema', () => {
  const validProblem: Partial<Problem> = {
    title: 'Hello World',
    authorId: 'author-123',
    classId: 'class-1',
    tags: ['loops', 'basics'],
  };

  describe('tags validation', () => {
    it('should accept valid tags', () => {
      const errors = validateProblemSchema({ ...validProblem, tags: ['loops', 'basics'] });
      const tagErrors = errors.filter((e) => e.field === 'tags');
      expect(tagErrors).toHaveLength(0);
    });

    it('should accept empty tags array', () => {
      const errors = validateProblemSchema({ ...validProblem, tags: [] });
      const tagErrors = errors.filter((e) => e.field === 'tags');
      expect(tagErrors).toHaveLength(0);
    });

    it('should reject more than 10 tags', () => {
      const tags = Array.from({ length: 11 }, (_, i) => `tag-${i}`);
      const errors = validateProblemSchema({ ...validProblem, tags });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'tags', code: 'MAX_COUNT' })
      );
    });

    it('should reject tags longer than 30 characters', () => {
      const errors = validateProblemSchema({
        ...validProblem,
        tags: ['a'.repeat(31)],
      });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'tags', code: 'MAX_LENGTH' })
      );
    });

    it('should reject tags with invalid characters', () => {
      const errors = validateProblemSchema({
        ...validProblem,
        tags: ['invalid tag!'],
      });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'tags', code: 'INVALID_FORMAT' })
      );
    });

    it('should accept tags with alphanumeric and hyphens', () => {
      const errors = validateProblemSchema({
        ...validProblem,
        tags: ['my-tag-1', 'another-tag'],
      });
      const tagErrors = errors.filter((e) => e.field === 'tags');
      expect(tagErrors).toHaveLength(0);
    });

    it('should reject empty string tags', () => {
      const errors = validateProblemSchema({
        ...validProblem,
        tags: [''],
      });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'tags', code: 'INVALID_FORMAT' })
      );
    });
  });

  describe('classId validation', () => {
    it('should require classId', () => {
      const errors = validateProblemSchema({ title: 'Test', authorId: 'a', tags: [] });
      expect(errors).toContainEqual(
        expect.objectContaining({ field: 'classId', code: 'REQUIRED_FIELD' })
      );
    });

    it('should accept valid classId', () => {
      const errors = validateProblemSchema(validProblem);
      const classErrors = errors.filter((e) => e.field === 'classId');
      expect(classErrors).toHaveLength(0);
    });
  });
});
