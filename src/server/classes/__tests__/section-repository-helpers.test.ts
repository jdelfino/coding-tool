/**
 * Unit tests for new SectionRepository helper methods
 */

import { FakeSectionRepository } from '../../__tests__/test-utils/fake-classes';

describe('SectionRepository - Helper Methods', () => {
  let repository: FakeSectionRepository;

  beforeEach(() => {
    repository = new FakeSectionRepository();
  });

  afterEach(() => {
    repository.clear();
  });

  describe('addInstructor', () => {
    it('should add instructor to section', async () => {
      // Create a section
      const section = await repository.createSection({
        namespaceId: 'default',
        classId: 'class-1',
        name: 'Section A',
        semester: 'Fall 2025',
        instructorIds: ['instructor-1'],
        active: true,
      });

      // Add another instructor
      await repository.addInstructor(section.id, 'instructor-2');

      // Verify instructor was added
      const updated = await repository.getSection(section.id);
      expect(updated).toBeDefined();
      expect(updated!.instructorIds).toContain('instructor-1');
      expect(updated!.instructorIds).toContain('instructor-2');
      expect(updated!.instructorIds.length).toBe(2);
    });

    it('should not add duplicate instructor', async () => {
      const section = await repository.createSection({
        namespaceId: 'default',
        classId: 'class-1',
        name: 'Section A',
        semester: 'Fall 2025',
        instructorIds: ['instructor-1'],
        active: true,
      });

      // Try to add same instructor again
      await repository.addInstructor(section.id, 'instructor-1');

      const updated = await repository.getSection(section.id);
      expect(updated!.instructorIds.length).toBe(1);
    });

    it('should throw error if section not found', async () => {
      await expect(
        repository.addInstructor('nonexistent-id', 'instructor-1')
      ).rejects.toThrow('Section not found');
    });
  });

  describe('removeInstructor', () => {
    it('should remove instructor from section', async () => {
      const section = await repository.createSection({
        namespaceId: 'default',
        classId: 'class-1',
        name: 'Section A',
        semester: 'Fall 2025',
        instructorIds: ['instructor-1', 'instructor-2'],
        active: true,
      });

      await repository.removeInstructor(section.id, 'instructor-2');

      const updated = await repository.getSection(section.id);
      expect(updated!.instructorIds).toEqual(['instructor-1']);
    });

    it('should handle removing non-existent instructor', async () => {
      const section = await repository.createSection({
        namespaceId: 'default',
        classId: 'class-1',
        name: 'Section A',
        semester: 'Fall 2025',
        instructorIds: ['instructor-1'],
        active: true,
      });

      // Should not throw error
      await repository.removeInstructor(section.id, 'instructor-99');

      const updated = await repository.getSection(section.id);
      expect(updated!.instructorIds).toEqual(['instructor-1']);
    });

    it('should throw error if section not found', async () => {
      await expect(
        repository.removeInstructor('nonexistent-id', 'instructor-1')
      ).rejects.toThrow('Section not found');
    });
  });
});
