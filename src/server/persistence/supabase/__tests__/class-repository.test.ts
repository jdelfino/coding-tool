/**
 * Unit tests for SupabaseClassRepository
 *
 * Tests the class repository implementation against the Supabase backend.
 * Uses Jest mocks configured per-test for clean isolation.
 */

import { SupabaseClassRepository } from '../class-repository';
import { Class, Section } from '../../../classes/types';

// Mock crypto.randomUUID
const mockUUID = 'generated-uuid-123';
jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID as `${string}-${string}-${string}-${string}-${string}`);

// Mock the Supabase client module
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockLimit = jest.fn();

jest.mock('../../../supabase/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('SupabaseClassRepository', () => {
  let repository: SupabaseClassRepository;

  const mockClass: Class = {
    id: 'class-123',
    namespaceId: 'stanford',
    name: 'CS 101 - Introduction to Programming',
    description: 'An introductory programming course',
    createdBy: 'instructor-456',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-05T10:30:00Z'),
  };

  const mockClassRow = {
    id: mockClass.id,
    namespace_id: mockClass.namespaceId,
    name: mockClass.name,
    description: mockClass.description,
    created_by: mockClass.createdBy,
    created_at: mockClass.createdAt.toISOString(),
    updated_at: mockClass.updatedAt.toISOString(),
  };

  const mockSection: Section = {
    id: 'section-789',
    namespaceId: 'stanford',
    classId: 'class-123',
    name: 'Section A',
    semester: 'Fall 2025',
    instructorIds: ['instructor-456'],
    joinCode: 'ABC-123-XYZ',
    active: true,
    createdAt: new Date('2025-01-02T00:00:00Z'),
    updatedAt: new Date('2025-01-02T00:00:00Z'),
  };

  const mockSectionRow = {
    id: mockSection.id,
    namespace_id: mockSection.namespaceId,
    class_id: mockSection.classId,
    name: mockSection.name,
    semester: mockSection.semester,
    instructor_ids: mockSection.instructorIds,
    join_code: mockSection.joinCode,
    active: mockSection.active,
    created_at: mockSection.createdAt.toISOString(),
    updated_at: mockSection.updatedAt.toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock chain for common patterns
    mockFrom.mockImplementation((table: string) => {
      return {
        // SELECT chain: .select().eq().single() OR .select().limit()
        select: jest.fn().mockReturnValue({
          eq: mockEq.mockReturnValue({
            eq: mockEq.mockReturnValue({
              single: mockSingle,
            }),
            single: mockSingle,
          }),
          limit: mockLimit,
        }),
        // INSERT chain: .insert().select().single()
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
        // UPDATE chain: .update().eq()
        update: jest.fn().mockReturnValue({
          eq: mockEq,
        }),
        // DELETE chain: .delete().eq()
        delete: jest.fn().mockReturnValue({
          eq: mockEq,
        }),
      };
    });

    repository = new SupabaseClassRepository();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      await expect(repository.initialize()).resolves.not.toThrow();
    });

    it('should throw error if initialization fails', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed' },
          }),
        }),
      });

      await expect(repository.initialize()).rejects.toThrow(
        'Failed to initialize ClassRepository: Connection failed'
      );
    });

    it('should not initialize twice', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      await repository.initialize();
      await repository.initialize();

      expect(mockFrom).toHaveBeenCalledTimes(1);
    });
  });

  describe('createClass', () => {
    it('should create a new class', async () => {
      const insertSingle = jest.fn().mockResolvedValue({ data: mockClassRow, error: null });
      const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
      const insertFn = jest.fn().mockReturnValue({ select: insertSelect });

      mockFrom.mockReturnValue({
        insert: insertFn,
      });

      const classData = {
        namespaceId: mockClass.namespaceId,
        name: mockClass.name,
        description: mockClass.description,
        createdBy: mockClass.createdBy,
      };

      const result = await repository.createClass(classData);

      expect(mockFrom).toHaveBeenCalledWith('classes');
      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockUUID,
          namespace_id: mockClass.namespaceId,
          name: mockClass.name,
          description: mockClass.description,
          created_by: mockClass.createdBy,
        })
      );
      expect(result.id).toBe(mockClass.id);
      expect(result.name).toBe(mockClass.name);
    });

    it('should create a class without optional description', async () => {
      const minimalClassRow = {
        ...mockClassRow,
        description: null,
      };

      const insertSingle = jest.fn().mockResolvedValue({ data: minimalClassRow, error: null });
      const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
      const insertFn = jest.fn().mockReturnValue({ select: insertSelect });

      mockFrom.mockReturnValue({
        insert: insertFn,
      });

      const classData = {
        namespaceId: mockClass.namespaceId,
        name: mockClass.name,
        createdBy: mockClass.createdBy,
      };

      const result = await repository.createClass(classData);

      expect(insertFn).toHaveBeenCalledWith(
        expect.objectContaining({
          description: null,
        })
      );
      expect(result.description).toBeUndefined();
    });

    it('should throw error on create failure', async () => {
      const insertSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });
      const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
      const insertFn = jest.fn().mockReturnValue({ select: insertSelect });

      mockFrom.mockReturnValue({
        insert: insertFn,
      });

      const classData = {
        namespaceId: mockClass.namespaceId,
        name: mockClass.name,
        createdBy: mockClass.createdBy,
      };

      await expect(repository.createClass(classData)).rejects.toThrow(
        'Failed to create class: Insert failed'
      );
    });
  });

  describe('getClass', () => {
    it('should get a class by ID', async () => {
      const singleFn = jest.fn().mockResolvedValue({ data: mockClassRow, error: null });
      const eqFn = jest.fn().mockReturnValue({ single: singleFn });
      const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.getClass(mockClass.id);

      expect(mockFrom).toHaveBeenCalledWith('classes');
      expect(eqFn).toHaveBeenCalledWith('id', mockClass.id);
      expect(result).toEqual(mockClass);
    });

    it('should get a class by ID with namespace filter', async () => {
      const singleFn = jest.fn().mockResolvedValue({ data: mockClassRow, error: null });
      const secondEqFn = jest.fn().mockReturnValue({ single: singleFn });
      const firstEqFn = jest.fn().mockReturnValue({ eq: secondEqFn });
      const selectFn = jest.fn().mockReturnValue({ eq: firstEqFn });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.getClass(mockClass.id, 'stanford');

      expect(firstEqFn).toHaveBeenCalledWith('id', mockClass.id);
      expect(secondEqFn).toHaveBeenCalledWith('namespace_id', 'stanford');
      expect(result).toEqual(mockClass);
    });

    it('should return null if class not found', async () => {
      const singleFn = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      const eqFn = jest.fn().mockReturnValue({ single: singleFn });
      const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.getClass('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      const singleFn = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Database error' },
      });
      const eqFn = jest.fn().mockReturnValue({ single: singleFn });
      const selectFn = jest.fn().mockReturnValue({ eq: eqFn });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      await expect(repository.getClass(mockClass.id)).rejects.toThrow(
        'Failed to get class: Database error'
      );
    });
  });

  describe('updateClass', () => {
    it('should update class fields', async () => {
      const updateEqFn = jest.fn().mockResolvedValue({ data: null, error: null });
      const updateFn = jest.fn().mockReturnValue({ eq: updateEqFn });

      mockFrom.mockReturnValue({
        update: updateFn,
      });

      const updates = {
        name: 'CS 201 - Advanced Programming',
        description: 'Updated description',
      };

      await repository.updateClass(mockClass.id, updates);

      expect(mockFrom).toHaveBeenCalledWith('classes');
      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({
          name: 'CS 201 - Advanced Programming',
          description: 'Updated description',
        })
      );
      expect(updateEqFn).toHaveBeenCalledWith('id', mockClass.id);
    });

    it('should update namespace', async () => {
      const updateEqFn = jest.fn().mockResolvedValue({ data: null, error: null });
      const updateFn = jest.fn().mockReturnValue({ eq: updateEqFn });

      mockFrom.mockReturnValue({
        update: updateFn,
      });

      await repository.updateClass(mockClass.id, { namespaceId: 'mit' });

      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({ namespace_id: 'mit' })
      );
    });

    it('should set description to null when empty string', async () => {
      const updateEqFn = jest.fn().mockResolvedValue({ data: null, error: null });
      const updateFn = jest.fn().mockReturnValue({ eq: updateEqFn });

      mockFrom.mockReturnValue({
        update: updateFn,
      });

      await repository.updateClass(mockClass.id, { description: '' });

      expect(updateFn).toHaveBeenCalledWith(
        expect.objectContaining({ description: null })
      );
    });

    it('should throw error on update failure', async () => {
      const updateEqFn = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });
      const updateFn = jest.fn().mockReturnValue({ eq: updateEqFn });

      mockFrom.mockReturnValue({
        update: updateFn,
      });

      await expect(
        repository.updateClass(mockClass.id, { name: 'New Name' })
      ).rejects.toThrow('Failed to update class: Update failed');
    });
  });

  describe('deleteClass', () => {
    it('should delete a class', async () => {
      const deleteEqFn = jest.fn().mockResolvedValue({ data: null, error: null });
      const deleteFn = jest.fn().mockReturnValue({ eq: deleteEqFn });

      mockFrom.mockReturnValue({
        delete: deleteFn,
      });

      await repository.deleteClass(mockClass.id);

      expect(mockFrom).toHaveBeenCalledWith('classes');
      expect(deleteEqFn).toHaveBeenCalledWith('id', mockClass.id);
    });

    it('should throw error on delete failure', async () => {
      const deleteEqFn = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });
      const deleteFn = jest.fn().mockReturnValue({ eq: deleteEqFn });

      mockFrom.mockReturnValue({
        delete: deleteFn,
      });

      await expect(repository.deleteClass(mockClass.id)).rejects.toThrow(
        'Failed to delete class: Delete failed'
      );
    });
  });

  describe('listClasses', () => {
    const mockClasses: Class[] = [
      mockClass,
      {
        id: 'class-456',
        namespaceId: 'stanford',
        name: 'CS 201 - Data Structures',
        createdBy: 'instructor-456',
        createdAt: new Date('2025-01-02T00:00:00Z'),
        updatedAt: new Date('2025-01-02T00:00:00Z'),
      },
    ];

    const mockClassRows = mockClasses.map((c) => ({
      id: c.id,
      namespace_id: c.namespaceId,
      name: c.name,
      description: c.description || null,
      created_by: c.createdBy,
      created_at: c.createdAt.toISOString(),
      updated_at: c.updatedAt.toISOString(),
    }));

    it('should list all classes without filters', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockClassRows, error: null }),
      });

      const result = await repository.listClasses();

      expect(mockFrom).toHaveBeenCalledWith('classes');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockClasses[0]);
      expect(result[1]).toEqual(mockClasses[1]);
    });

    it('should list classes filtered by createdBy', async () => {
      const selectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: mockClassRows, error: null }),
      });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.listClasses('instructor-456');

      expect(result).toHaveLength(2);
    });

    it('should list classes filtered by namespace', async () => {
      const selectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: mockClassRows, error: null }),
      });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.listClasses(undefined, 'stanford');

      expect(result).toHaveLength(2);
    });

    it('should list classes filtered by both createdBy and namespace', async () => {
      const secondEq = jest.fn().mockResolvedValue({ data: [mockClassRows[0]], error: null });
      const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
      const selectFn = jest.fn().mockReturnValue({ eq: firstEq });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.listClasses('instructor-456', 'stanford');

      expect(result).toHaveLength(1);
    });

    it('should return empty array if no classes found', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await repository.listClasses();

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(repository.listClasses()).rejects.toThrow(
        'Failed to list classes: Database error'
      );
    });
  });

  describe('getClassSections', () => {
    const mockSections: Section[] = [
      mockSection,
      {
        id: 'section-890',
        namespaceId: 'stanford',
        classId: 'class-123',
        name: 'Section B',
        semester: 'Fall 2025',
        instructorIds: ['instructor-789'],
        joinCode: 'DEF-456-UVW',
        active: true,
        createdAt: new Date('2025-01-03T00:00:00Z'),
        updatedAt: new Date('2025-01-03T00:00:00Z'),
      },
    ];

    const mockSectionRows = mockSections.map((s) => ({
      id: s.id,
      namespace_id: s.namespaceId,
      class_id: s.classId,
      name: s.name,
      semester: s.semester || null,
      instructor_ids: s.instructorIds,
      join_code: s.joinCode,
      active: s.active,
      created_at: s.createdAt.toISOString(),
      updated_at: s.updatedAt.toISOString(),
    }));

    it('should get sections for a class', async () => {
      const selectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: mockSectionRows, error: null }),
      });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.getClassSections('class-123');

      expect(mockFrom).toHaveBeenCalledWith('sections');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockSections[0]);
      expect(result[1]).toEqual(mockSections[1]);
    });

    it('should get sections with namespace filter', async () => {
      const secondEq = jest.fn().mockResolvedValue({ data: mockSectionRows, error: null });
      const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
      const selectFn = jest.fn().mockReturnValue({ eq: firstEq });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.getClassSections('class-123', 'stanford');

      expect(firstEq).toHaveBeenCalledWith('class_id', 'class-123');
      expect(secondEq).toHaveBeenCalledWith('namespace_id', 'stanford');
      expect(result).toHaveLength(2);
    });

    it('should return empty array if no sections found', async () => {
      const selectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.getClassSections('class-with-no-sections');

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      const selectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      await expect(repository.getClassSections('class-123')).rejects.toThrow(
        'Failed to get class sections: Database error'
      );
    });
  });

  describe('health', () => {
    it('should return true if database is accessible', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await repository.health();

      expect(result).toBe(true);
    });

    it('should return false if database query fails', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection error' },
          }),
        }),
      });

      const result = await repository.health();

      expect(result).toBe(false);
    });

    it('should return false if exception is thrown', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await repository.health();

      expect(result).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(repository.shutdown()).resolves.not.toThrow();
    });

    it('should allow reinitialization after shutdown', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      await repository.initialize();
      await repository.shutdown();
      await repository.initialize();

      expect(mockFrom).toHaveBeenCalledTimes(2);
    });
  });
});
