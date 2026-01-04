/**
 * Unit tests for ClassRepository
 * 
 * Tests CRUD operations for course classes using in-memory storage
 */

import { FakeClassRepository, FakeSectionRepository } from '../../__tests__/test-utils/fake-classes';

describe('ClassRepository', () => {
  let repository: FakeClassRepository;
  let mockSectionRepository: FakeSectionRepository;

  beforeEach(() => {
    repository = new FakeClassRepository();
    mockSectionRepository = new FakeSectionRepository();
    repository.setSectionRepository(mockSectionRepository);
  });

  afterEach(() => {
    repository.clear();
    mockSectionRepository.clear();
  });

  describe('createClass', () => {
    it('should create class with valid data', async () => {
      const classData = {
        namespaceId: 'default',
        name: 'CS 101',
        description: 'Introduction to Computer Science',
        createdBy: 'instructor-1',
      };

      const created = await repository.createClass(classData);

      expect(created).toBeDefined();
      expect(created.id).toMatch(/^class-/);
      expect(created.name).toBe('CS 101');
      expect(created.description).toBe('Introduction to Computer Science');
      expect(created.createdBy).toBe('instructor-1');
      expect(created.createdAt).toBeInstanceOf(Date);
      expect(created.updatedAt).toBeInstanceOf(Date);
      expect(created.createdAt.getTime()).toBe(created.updatedAt.getTime());
    });

    it('should create class without description', async () => {
      const classData = {
        namespaceId: 'default',
        name: 'CS 202',
        createdBy: 'instructor-2',
      };

      const created = await repository.createClass(classData);

      expect(created.name).toBe('CS 202');
      expect(created.description).toBeUndefined();
      expect(created.createdBy).toBe('instructor-2');
    });

    it('should assign unique IDs to multiple classes', async () => {
      const class1 = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      const class2 = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 202',
        createdBy: 'instructor-1',
      });

      expect(class1.id).not.toBe(class2.id);
    });

    it('should persist to disk', async () => {
      const classData = {
        namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      };

      const created = await repository.createClass(classData);

      // Verify class is retrievable
      const retrieved = await repository.getClass(created.id);
      expect(retrieved).not.toBeNull();
      expect(retrieved?.name).toBe('CS 101');
    });
  });

  describe('getClass', () => {
    it('should retrieve existing class', async () => {
      const created = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      const retrieved = await repository.getClass(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.id).toBe(created.id);
      expect(retrieved?.name).toBe('CS 101');
    });

    it('should return null for non-existent class', async () => {
      const result = await repository.getClass('non-existent-id');
      expect(result).toBeNull();
    });

    it('should handle date deserialization correctly', async () => {
      const created = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      // Retrieve should work correctly
      const retrieved = await repository.getClass(created.id);

      expect(retrieved).not.toBeNull();
      expect(retrieved?.createdAt).toBeInstanceOf(Date);
      expect(retrieved?.updatedAt).toBeInstanceOf(Date);
    });
  });

  describe('updateClass', () => {
    it('should update class fields correctly', async () => {
      const created = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        description: 'Old description',
        createdBy: 'instructor-1',
      });

      await repository.updateClass(created.id, {
        name: 'CS 101 Updated',
        description: 'New description',
      });

      const updated = await repository.getClass(created.id);
      expect(updated?.name).toBe('CS 101 Updated');
      expect(updated?.description).toBe('New description');
      expect(updated?.createdBy).toBe('instructor-1'); // Should not change
    });

    it('should update updatedAt timestamp', async () => {
      const created = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      // Wait a bit to ensure timestamp difference
      await new Promise(resolve => setTimeout(resolve, 10));

      await repository.updateClass(created.id, { name: 'CS 101 Updated' });

      const updated = await repository.getClass(created.id);
      expect(updated?.updatedAt.getTime()).toBeGreaterThan(created.updatedAt.getTime());
    });

    it('should preserve ID and createdAt', async () => {
      const created = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      await repository.updateClass(created.id, {
        name: 'CS 101 Updated',
      });

      const updated = await repository.getClass(created.id);
      expect(updated?.id).toBe(created.id);
      expect(updated?.createdAt.getTime()).toBe(created.createdAt.getTime());
    });

    it('should throw error for non-existent class', async () => {
      await expect(
        repository.updateClass('non-existent-id', { name: 'Updated' })
      ).rejects.toThrow('Class not found');
    });

    it('should persist updates to disk', async () => {
      const created = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      await repository.updateClass(created.id, { name: 'CS 101 Updated' });

      // Retrieve should get updated value
      const retrieved = await repository.getClass(created.id);
      expect(retrieved?.name).toBe('CS 101 Updated');
    });
  });

  describe('deleteClass', () => {
    it('should remove class', async () => {
      const created = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      await repository.deleteClass(created.id);

      const retrieved = await repository.getClass(created.id);
      expect(retrieved).toBeNull();
    });

    it('should throw error for non-existent class', async () => {
      await expect(
        repository.deleteClass('non-existent-id')
      ).rejects.toThrow('Class not found');
    });

    it('should persist deletion to disk', async () => {
      const created = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      await repository.deleteClass(created.id);

      // Retrieve should return null
      const retrieved = await repository.getClass(created.id);
      expect(retrieved).toBeNull();
    });
  });

  describe('listClasses', () => {
    it('should return all classes when no filter provided', async () => {
      await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      await repository.createClass({
      namespaceId: 'default',
        name: 'CS 202',
        createdBy: 'instructor-2',
      });

      const classes = await repository.listClasses();
      expect(classes).toHaveLength(2);
    });

    it('should filter classes by creator', async () => {
      await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      await repository.createClass({
      namespaceId: 'default',
        name: 'CS 202',
        createdBy: 'instructor-2',
      });

      await repository.createClass({
      namespaceId: 'default',
        name: 'CS 303',
        createdBy: 'instructor-1',
      });

      const classes = await repository.listClasses('instructor-1');
      expect(classes).toHaveLength(2);
      expect(classes.every(c => c.createdBy === 'instructor-1')).toBe(true);
    });

    it('should return empty array when no classes exist', async () => {
      const classes = await repository.listClasses();
      expect(classes).toEqual([]);
    });

    it('should sort classes by creation date (newest first)', async () => {
      const class1 = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      await new Promise(resolve => setTimeout(resolve, 10));

      const class2 = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 202',
        createdBy: 'instructor-1',
      });

      const classes = await repository.listClasses();
      expect(classes[0].id).toBe(class2.id); // Newer class first
      expect(classes[1].id).toBe(class1.id);
    });
  });

  describe('getClassSections', () => {
    it('should return sections for a class', async () => {
      const created = await repository.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });

      // Create sections using the mock repository
      await mockSectionRepository.createSection({
        namespaceId: 'default',
      classId: created.id,
        name: 'Section A',
        instructorIds: ['instructor-1'],
        active: true,
      });

      await mockSectionRepository.createSection({
        namespaceId: 'default',
      classId: created.id,
        name: 'Section B',
        instructorIds: ['instructor-1'],
        active: true,
      });

      const sections = await repository.getClassSections(created.id);

      expect(sections).toHaveLength(2);
      expect(sections.map(s => s.name)).toContain('Section A');
      expect(sections.map(s => s.name)).toContain('Section B');
    });

    it('should throw error for non-existent class', async () => {
      await expect(
        repository.getClassSections('non-existent-id')
      ).rejects.toThrow('Class not found');
    });

    it('should throw error if section repository not configured', async () => {
      // Create repository without section repository
      const repoWithoutSections = new FakeClassRepository();
      
      const created = await repoWithoutSections.createClass({
      namespaceId: 'default',
        name: 'CS 101',
        createdBy: 'instructor-1',
      });
      
      await expect(
        repoWithoutSections.getClassSections(created.id)
      ).rejects.toThrow('Section repository not configured');
    });
  });
});
