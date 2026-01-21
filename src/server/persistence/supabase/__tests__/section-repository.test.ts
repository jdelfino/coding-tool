/**
 * Unit tests for SupabaseSectionRepository
 *
 * Tests the section repository implementation against the Supabase backend.
 * Uses Jest mocks configured per-test for clean isolation.
 */

import { SupabaseSectionRepository } from '../section-repository';
import { Section, SectionStats } from '../../../classes/types';

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
const mockContains = jest.fn();

jest.mock('../../../supabase/client', () => ({
  getSupabaseClientWithAuth: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('SupabaseSectionRepository', () => {
  let repository: SupabaseSectionRepository;

  const mockSection: Section = {
    id: 'section-123',
    namespaceId: 'stanford',
    classId: 'class-456',
    name: 'Section A',
    semester: 'Fall 2025',
    instructorIds: ['instructor-789'],
    joinCode: 'ABC-123-XYZ',
    active: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-05T10:30:00Z'),
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
          contains: mockContains.mockReturnValue({}),
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

    repository = new SupabaseSectionRepository('test-token');
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
        'Failed to initialize SectionRepository: Connection failed'
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

  describe('shutdown', () => {
    it('should shutdown without errors', async () => {
      await expect(repository.shutdown()).resolves.not.toThrow();
    });
  });

  describe('health', () => {
    it('should return true when connection is healthy', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await repository.health();
      expect(result).toBe(true);
    });

    it('should return false when connection fails', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed' },
          }),
        }),
      });

      const result = await repository.health();
      expect(result).toBe(false);
    });

    it('should return false on exception', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const result = await repository.health();
      expect(result).toBe(false);
    });
  });

  describe('createSection', () => {
    it('should create a section with generated join code', async () => {
      // Mock the join code uniqueness check
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockSectionRow, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const sectionData = {
        namespaceId: mockSection.namespaceId,
        classId: mockSection.classId,
        name: mockSection.name,
        semester: mockSection.semester,
        instructorIds: mockSection.instructorIds,
        active: mockSection.active,
      };

      const result = await repository.createSection(sectionData);

      expect(result).toMatchObject({
        id: mockSection.id,
        namespaceId: mockSection.namespaceId,
        classId: mockSection.classId,
        name: mockSection.name,
        joinCode: mockSection.joinCode,
      });
    });

    it('should retry join code generation if collision occurs', async () => {
      let selectCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockImplementation(() => {
                  selectCallCount++;
                  // First call returns existing (collision), second returns null (success)
                  if (selectCallCount === 1) {
                    return Promise.resolve({ data: { id: 'other-section' }, error: null });
                  }
                  return Promise.resolve({ data: null, error: { code: 'PGRST116' } });
                }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockSectionRow, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const sectionData = {
        namespaceId: mockSection.namespaceId,
        classId: mockSection.classId,
        name: mockSection.name,
        semester: mockSection.semester,
        instructorIds: mockSection.instructorIds,
        active: mockSection.active,
      };

      const result = await repository.createSection(sectionData);

      expect(result).toBeDefined();
      expect(selectCallCount).toBe(2); // Retried once
    });

    it('should throw error if cannot generate unique join code', async () => {
      // Always return existing join code
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: { id: 'existing' }, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      const sectionData = {
        namespaceId: mockSection.namespaceId,
        classId: mockSection.classId,
        name: mockSection.name,
        semester: mockSection.semester,
        instructorIds: mockSection.instructorIds,
        active: mockSection.active,
      };

      await expect(repository.createSection(sectionData)).rejects.toThrow(
        'Failed to generate unique join code after maximum attempts'
      );
    });

    it('should throw error if insert fails', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
            insert: jest.fn().mockReturnValue({
              select: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({
                  data: null,
                  error: { message: 'Constraint violation' },
                }),
              }),
            }),
          };
        }
        return {};
      });

      const sectionData = {
        namespaceId: mockSection.namespaceId,
        classId: mockSection.classId,
        name: mockSection.name,
        semester: mockSection.semester,
        instructorIds: mockSection.instructorIds,
        active: mockSection.active,
      };

      await expect(repository.createSection(sectionData)).rejects.toThrow(
        'Failed to create section: Constraint violation'
      );
    });
  });

  describe('getSection', () => {
    it('should get a section by id', async () => {
      mockSingle.mockResolvedValue({ data: mockSectionRow, error: null });

      const result = await repository.getSection('section-123');

      expect(result).toMatchObject({
        id: mockSection.id,
        name: mockSection.name,
        joinCode: mockSection.joinCode,
      });
    });

    it('should return null if section not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await repository.getSection('nonexistent');

      expect(result).toBeNull();
    });

    it('should filter by namespace if provided', async () => {
      mockSingle.mockResolvedValue({ data: mockSectionRow, error: null });

      await repository.getSection('section-123', 'stanford');

      expect(mockEq).toHaveBeenCalledWith('namespace_id', 'stanford');
    });

    it('should throw error on database error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database error' },
      });

      await expect(repository.getSection('section-123')).rejects.toThrow(
        'Failed to get section: Database error'
      );
    });
  });

  describe('getSectionByJoinCode', () => {
    it('should get a section by join code', async () => {
      mockSingle.mockResolvedValue({ data: mockSectionRow, error: null });

      const result = await repository.getSectionByJoinCode('ABC-123-XYZ');

      expect(result).toMatchObject({
        id: mockSection.id,
        joinCode: 'ABC-123-XYZ',
      });
    });

    it('should return null if section not found', async () => {
      mockSingle.mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      const result = await repository.getSectionByJoinCode('INVALID');

      expect(result).toBeNull();
    });

    it('should throw error on database error', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'OTHER_ERROR', message: 'Database error' },
      });

      await expect(repository.getSectionByJoinCode('ABC-123-XYZ')).rejects.toThrow(
        'Failed to get section by join code: Database error'
      );
    });
  });

  describe('updateSection', () => {
    it('should update a section', async () => {
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      await expect(
        repository.updateSection('section-123', { name: 'Section B' })
      ).resolves.not.toThrow();
    });

    it('should throw error if update fails', async () => {
      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Update failed' },
          }),
        }),
      });

      await expect(repository.updateSection('section-123', { name: 'Section B' })).rejects.toThrow(
        'Failed to update section: Update failed'
      );
    });
  });

  describe('deleteSection', () => {
    it('should delete a section', async () => {
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      await expect(repository.deleteSection('section-123')).resolves.not.toThrow();
    });

    it('should throw error if delete fails', async () => {
      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Delete failed' },
          }),
        }),
      });

      await expect(repository.deleteSection('section-123')).rejects.toThrow(
        'Failed to delete section: Delete failed'
      );
    });
  });

  describe('listSections', () => {
    it('should list all sections without filters', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [mockSectionRow], error: null }),
      });

      const result = await repository.listSections();

      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({
        id: mockSection.id,
        name: mockSection.name,
      });
    });

    it('should filter by classId', async () => {
      const mockEqChain = jest.fn().mockResolvedValue({ data: [mockSectionRow], error: null });
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEqChain,
        }),
      });

      const result = await repository.listSections({ classId: 'class-456' });

      expect(result).toHaveLength(1);
      expect(mockEqChain).toHaveBeenCalledWith('class_id', 'class-456');
    });

    it('should filter by instructorId', async () => {
      const mockContainsChain = jest.fn().mockResolvedValue({ data: [mockSectionRow], error: null });
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          contains: mockContainsChain,
        }),
      });

      const result = await repository.listSections({ instructorId: 'instructor-789' });

      expect(result).toHaveLength(1);
      expect(mockContainsChain).toHaveBeenCalledWith('instructor_ids', ['instructor-789']);
    });

    it('should filter by active status', async () => {
      const mockEqChain = jest.fn().mockResolvedValue({ data: [mockSectionRow], error: null });
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEqChain,
        }),
      });

      const result = await repository.listSections({ active: true });

      expect(result).toHaveLength(1);
      expect(mockEqChain).toHaveBeenCalledWith('active', true);
    });

    it('should throw error if listing fails', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Query failed' },
        }),
      });

      await expect(repository.listSections()).rejects.toThrow('Failed to list sections: Query failed');
    });
  });

  describe('regenerateJoinCode', () => {
    it('should regenerate join code for a section', async () => {
      // Mock join code uniqueness check
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return {};
      });

      const newJoinCode = await repository.regenerateJoinCode('section-123');

      // Join code is now 6 characters without dashes
      expect(newJoinCode).toMatch(/^[A-Z0-9]{6}$/);
    });

    it('should throw error if update fails', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Update failed' },
              }),
            }),
          };
        }
        return {};
      });

      await expect(repository.regenerateJoinCode('section-123')).rejects.toThrow(
        'Failed to regenerate join code: Update failed'
      );
    });
  });

  describe('addInstructor', () => {
    it('should add an instructor to a section', async () => {
      // Mock getSection
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockSectionRow, error: null }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return {};
      });

      await expect(
        repository.addInstructor('section-123', 'new-instructor')
      ).resolves.not.toThrow();
    });

    it('should be idempotent - no error if instructor already exists', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockSectionRow, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        repository.addInstructor('section-123', 'instructor-789')
      ).resolves.not.toThrow();
    });

    it('should throw error if section not found', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(repository.addInstructor('nonexistent', 'instructor')).rejects.toThrow(
        'Section nonexistent not found'
      );
    });
  });

  describe('removeInstructor', () => {
    it('should remove an instructor from a section', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockSectionRow, error: null }),
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: null, error: null }),
            }),
          };
        }
        return {};
      });

      await expect(
        repository.removeInstructor('section-123', 'instructor-789')
      ).resolves.not.toThrow();
    });

    it('should be idempotent - no error if instructor does not exist', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockSectionRow, error: null }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(
        repository.removeInstructor('section-123', 'nonexistent')
      ).resolves.not.toThrow();
    });

    it('should throw error if section not found', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sections') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(repository.removeInstructor('nonexistent', 'instructor')).rejects.toThrow(
        'Section nonexistent not found'
      );
    });
  });

  describe('getSectionStats', () => {
    it('should return section statistics', async () => {
      let sessionsCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'section_memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: 25, error: null }),
              }),
            }),
          };
        } else if (table === 'sessions') {
          sessionsCallCount++;
          if (sessionsCallCount === 1) {
            // First call - total session count (with section_id filter only)
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: 10, error: null }),
              }),
            };
          } else {
            // Second call - active session count (with section_id and status filters)
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({ count: 3, error: null }),
                }),
              }),
            };
          }
        }
        return {};
      });

      const stats = await repository.getSectionStats('section-123');

      expect(stats).toEqual({
        studentCount: 25,
        sessionCount: 10,
        activeSessionCount: 3,
      });
    });

    it('should handle zero counts', async () => {
      let sessionsCallCount = 0;
      mockFrom.mockImplementation((table: string) => {
        if (table === 'section_memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: null, error: null }),
              }),
            }),
          };
        } else if (table === 'sessions') {
          sessionsCallCount++;
          if (sessionsCallCount === 1) {
            // First call - total session count
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({ count: null, error: null }),
              }),
            };
          } else {
            // Second call - active session count
            return {
              select: jest.fn().mockReturnValue({
                eq: jest.fn().mockReturnValue({
                  eq: jest.fn().mockResolvedValue({ count: null, error: null }),
                }),
              }),
            };
          }
        }
        return {};
      });

      const stats = await repository.getSectionStats('section-123');

      expect(stats).toEqual({
        studentCount: 0,
        sessionCount: 0,
        activeSessionCount: 0,
      });
    });

    it('should throw error if student count query fails', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'section_memberships') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                eq: jest.fn().mockResolvedValue({
                  count: null,
                  error: { message: 'Query failed' },
                }),
              }),
            }),
          };
        }
        return {};
      });

      await expect(repository.getSectionStats('section-123')).rejects.toThrow(
        'Failed to count students: Query failed'
      );
    });
  });
});
