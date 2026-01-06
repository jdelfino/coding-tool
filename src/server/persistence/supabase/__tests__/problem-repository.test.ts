/**
 * Unit tests for SupabaseProblemRepository
 *
 * Tests the problem repository implementation against the Supabase backend.
 * Uses Jest mocks configured per-test for clean isolation.
 */

import { SupabaseProblemRepository } from '../problem-repository';
import { Problem, ProblemInput, ProblemMetadata } from '../../../types/problem';

// Mock crypto.randomUUID
const mockUUID = 'test-uuid-1234';
jest.spyOn(crypto, 'randomUUID').mockReturnValue(mockUUID as `${string}-${string}-${string}-${string}-${string}`);

// Mock the Supabase client module
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockOr = jest.fn();
const mockOrder = jest.fn();
const mockSingle = jest.fn();
const mockLimit = jest.fn();

jest.mock('../../../supabase/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('SupabaseProblemRepository', () => {
  let repository: SupabaseProblemRepository;

  const mockProblem: Problem = {
    id: 'problem-123',
    namespaceId: 'stanford',
    title: 'Hello World',
    description: 'Print Hello World',
    starterCode: 'print("Hello")',
    testCases: [
      {
        id: 'tc1',
        problemId: 'problem-123',
        type: 'input-output',
        name: 'Basic test',
        description: 'Basic test',
        visible: true,
        order: 1,
        config: {
          type: 'input-output',
          data: {
            input: '',
            expectedOutput: 'Hello World',
            matchType: 'exact',
          },
        },
      },
    ],
    executionSettings: { stdin: '' },
    authorId: 'author-456',
    classId: 'class-789',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-02T00:00:00Z'),
  };

  const mockProblemRow = {
    id: mockProblem.id,
    namespace_id: mockProblem.namespaceId,
    title: mockProblem.title,
    description: mockProblem.description,
    starter_code: mockProblem.starterCode,
    test_cases: mockProblem.testCases,
    execution_settings: mockProblem.executionSettings,
    author_id: mockProblem.authorId,
    class_id: mockProblem.classId,
    created_at: mockProblem.createdAt.toISOString(),
    updated_at: mockProblem.updatedAt.toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock chain for common patterns
    mockFrom.mockImplementation((table: string) => {
      return {
        select: jest.fn().mockReturnValue({
          eq: mockEq.mockReturnValue({
            eq: mockEq,
            single: mockSingle,
            order: mockOrder,
          }),
          or: mockOr.mockReturnValue({
            eq: mockEq,
            order: mockOrder,
          }),
          order: mockOrder,
          limit: mockLimit,
        }),
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
        update: jest.fn().mockReturnValue({
          eq: mockEq.mockReturnValue({
            select: jest.fn().mockReturnValue({
              single: mockSingle,
            }),
          }),
        }),
        delete: jest.fn().mockReturnValue({
          eq: mockEq,
        }),
      };
    });

    repository = new SupabaseProblemRepository();
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
        'Failed to initialize ProblemRepository: Connection failed'
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

  describe('create', () => {
    it('should create a new problem', async () => {
      const input: ProblemInput = {
        namespaceId: mockProblem.namespaceId,
        title: mockProblem.title,
        description: mockProblem.description,
        starterCode: mockProblem.starterCode,
        testCases: mockProblem.testCases,
        executionSettings: mockProblem.executionSettings,
        authorId: mockProblem.authorId,
        classId: mockProblem.classId,
      };

      const insertSingle = jest.fn().mockResolvedValue({
        data: { ...mockProblemRow, id: mockUUID },
        error: null,
      });

      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: insertSingle,
          }),
        }),
      });

      const result = await repository.create(input);

      expect(mockFrom).toHaveBeenCalledWith('problems');
      expect(result.id).toBe(mockUUID);
      expect(result.title).toBe(input.title);
      expect(result.namespaceId).toBe(input.namespaceId);
    });

    it('should create problem without optional fields', async () => {
      const minimalInput: ProblemInput = {
        namespaceId: 'stanford',
        title: 'Minimal Problem',
        authorId: 'author-123',
      };

      const insertSingle = jest.fn().mockResolvedValue({
        data: {
          id: mockUUID,
          namespace_id: minimalInput.namespaceId,
          title: minimalInput.title,
          description: null,
          starter_code: null,
          test_cases: null,
          execution_settings: null,
          author_id: minimalInput.authorId,
          class_id: null,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
        error: null,
      });

      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: insertSingle,
          }),
        }),
      });

      const result = await repository.create(minimalInput);

      expect(result.id).toBe(mockUUID);
      expect(result.description).toBeUndefined();
      expect(result.starterCode).toBeUndefined();
    });

    it('should throw error on create failure', async () => {
      const insertSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      mockFrom.mockReturnValue({
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: insertSingle,
          }),
        }),
      });

      await expect(
        repository.create({
          namespaceId: 'stanford',
          title: 'Test',
          authorId: 'author-1',
        })
      ).rejects.toThrow('Failed to create problem: Insert failed');
    });
  });

  describe('getById', () => {
    it('should get a problem by ID', async () => {
      const selectSingle = jest.fn().mockResolvedValue({ data: mockProblemRow, error: null });
      const selectEq = jest.fn().mockReturnValue({ single: selectSingle });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      const result = await repository.getById(mockProblem.id);

      expect(mockFrom).toHaveBeenCalledWith('problems');
      expect(selectEq).toHaveBeenCalledWith('id', mockProblem.id);
      expect(result).toEqual(mockProblem);
    });

    it('should get a problem by ID with namespace filter', async () => {
      const selectSingle = jest.fn().mockResolvedValue({ data: mockProblemRow, error: null });
      const secondEq = jest.fn().mockReturnValue({ single: selectSingle });
      const firstEq = jest.fn().mockReturnValue({ eq: secondEq });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: firstEq,
        }),
      });

      const result = await repository.getById(mockProblem.id, 'stanford');

      expect(firstEq).toHaveBeenCalledWith('id', mockProblem.id);
      expect(result).toBeDefined();
    });

    it('should return null if problem not found', async () => {
      const selectSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      const selectEq = jest.fn().mockReturnValue({ single: selectSingle });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      const result = await repository.getById('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      const selectSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Database error' },
      });
      const selectEq = jest.fn().mockReturnValue({ single: selectSingle });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      await expect(repository.getById(mockProblem.id)).rejects.toThrow(
        'Failed to get problem: Database error'
      );
    });
  });

  describe('getAll', () => {
    const mockMetadataRow = {
      id: mockProblem.id,
      namespace_id: mockProblem.namespaceId,
      title: mockProblem.title,
      test_cases: mockProblem.testCases,
      created_at: mockProblem.createdAt.toISOString(),
      author_id: mockProblem.authorId,
      class_id: mockProblem.classId,
    };

    it('should get all problems without filters', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [mockMetadataRow], error: null }),
      });

      const result = await repository.getAll();

      expect(mockFrom).toHaveBeenCalledWith('problems');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockProblem.id);
      expect(result[0].testCaseCount).toBe(1);
    });

    it('should get all problems with namespace filter', async () => {
      const selectEq = jest.fn().mockResolvedValue({ data: [mockMetadataRow], error: null });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      const result = await repository.getAll(undefined, 'stanford');

      expect(selectEq).toHaveBeenCalledWith('namespace_id', 'stanford');
      expect(result).toHaveLength(1);
    });

    it('should get all problems with author filter', async () => {
      const secondEq = jest.fn().mockResolvedValue({ data: [mockMetadataRow], error: null });
      const firstEq = jest.fn().mockReturnValue({ eq: secondEq });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: firstEq,
        }),
      });

      const result = await repository.getAll({ authorId: 'author-456' }, 'stanford');

      expect(result).toHaveLength(1);
    });

    it('should get all problems with sorting', async () => {
      const sortedOrder = jest.fn().mockResolvedValue({ data: [mockMetadataRow], error: null });
      const selectEq = jest.fn().mockReturnValue({ order: sortedOrder });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      const result = await repository.getAll({ sortBy: 'title', sortOrder: 'asc' }, 'stanford');

      expect(result).toHaveLength(1);
    });

    it('should return empty array if no problems found', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await repository.getAll();

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(repository.getAll()).rejects.toThrow('Failed to get problems: Database error');
    });
  });

  describe('update', () => {
    it('should update problem fields', async () => {
      const updateSingle = jest.fn().mockResolvedValue({
        data: { ...mockProblemRow, title: 'Updated Title' },
        error: null,
      });
      const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
      const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
      const updateFn = jest.fn().mockReturnValue({ eq: updateEq });

      mockFrom.mockReturnValue({
        update: updateFn,
      });

      const result = await repository.update(mockProblem.id, { title: 'Updated Title' });

      expect(mockFrom).toHaveBeenCalledWith('problems');
      expect(updateEq).toHaveBeenCalledWith('id', mockProblem.id);
      expect(result.title).toBe('Updated Title');
    });

    it('should update multiple fields', async () => {
      const updatedRow = {
        ...mockProblemRow,
        title: 'New Title',
        description: 'New Description',
        starter_code: 'print("new")',
      };

      const updateSingle = jest.fn().mockResolvedValue({ data: updatedRow, error: null });
      const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
      const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
      const updateFn = jest.fn().mockReturnValue({ eq: updateEq });

      mockFrom.mockReturnValue({
        update: updateFn,
      });

      const result = await repository.update(mockProblem.id, {
        title: 'New Title',
        description: 'New Description',
        starterCode: 'print("new")',
      });

      expect(result.title).toBe('New Title');
      expect(result.description).toBe('New Description');
    });

    it('should throw error if problem not found', async () => {
      const updateSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
      const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
      const updateFn = jest.fn().mockReturnValue({ eq: updateEq });

      mockFrom.mockReturnValue({
        update: updateFn,
      });

      await expect(repository.update('nonexistent', { title: 'New' })).rejects.toThrow(
        'Problem not found: nonexistent'
      );
    });

    it('should throw error on update failure', async () => {
      const updateSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Update failed' },
      });
      const updateSelect = jest.fn().mockReturnValue({ single: updateSingle });
      const updateEq = jest.fn().mockReturnValue({ select: updateSelect });
      const updateFn = jest.fn().mockReturnValue({ eq: updateEq });

      mockFrom.mockReturnValue({
        update: updateFn,
      });

      await expect(repository.update(mockProblem.id, { title: 'New' })).rejects.toThrow(
        'Failed to update problem: Update failed'
      );
    });
  });

  describe('delete', () => {
    it('should delete a problem', async () => {
      const deleteEq = jest.fn().mockResolvedValue({ data: null, error: null });
      const deleteFn = jest.fn().mockReturnValue({ eq: deleteEq });

      mockFrom.mockReturnValue({
        delete: deleteFn,
      });

      await repository.delete(mockProblem.id);

      expect(mockFrom).toHaveBeenCalledWith('problems');
      expect(deleteEq).toHaveBeenCalledWith('id', mockProblem.id);
    });

    it('should throw error on delete failure', async () => {
      const deleteEq = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });
      const deleteFn = jest.fn().mockReturnValue({ eq: deleteEq });

      mockFrom.mockReturnValue({
        delete: deleteFn,
      });

      await expect(repository.delete(mockProblem.id)).rejects.toThrow(
        'Failed to delete problem: Delete failed'
      );
    });
  });

  describe('search', () => {
    const mockMetadataRow = {
      id: mockProblem.id,
      namespace_id: mockProblem.namespaceId,
      title: mockProblem.title,
      test_cases: mockProblem.testCases,
      created_at: mockProblem.createdAt.toISOString(),
      author_id: mockProblem.authorId,
      class_id: mockProblem.classId,
    };

    it('should search problems by query', async () => {
      const orResult = jest.fn().mockResolvedValue({ data: [mockMetadataRow], error: null });
      const selectOr = jest.fn().mockReturnValue(orResult());

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: selectOr,
        }),
      });

      const result = await repository.search('Hello');

      expect(mockFrom).toHaveBeenCalledWith('problems');
      expect(result).toHaveLength(1);
      expect(result[0].title).toBe(mockProblem.title);
    });

    it('should search with namespace filter', async () => {
      const orEq = jest.fn().mockResolvedValue({ data: [mockMetadataRow], error: null });
      const selectOr = jest.fn().mockReturnValue({ eq: orEq });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: selectOr,
        }),
      });

      const result = await repository.search('Hello', undefined, 'stanford');

      expect(orEq).toHaveBeenCalledWith('namespace_id', 'stanford');
      expect(result).toHaveLength(1);
    });

    it('should return empty array if no matches', async () => {
      const selectOr = jest.fn().mockResolvedValue({ data: [], error: null });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: selectOr,
        }),
      });

      const result = await repository.search('nonexistent');

      expect(result).toEqual([]);
    });

    it('should throw error on search failure', async () => {
      const selectOr = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Search failed' },
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          or: selectOr,
        }),
      });

      await expect(repository.search('test')).rejects.toThrow(
        'Failed to search problems: Search failed'
      );
    });
  });

  describe('getByAuthor', () => {
    const mockMetadataRow = {
      id: mockProblem.id,
      namespace_id: mockProblem.namespaceId,
      title: mockProblem.title,
      test_cases: mockProblem.testCases,
      created_at: mockProblem.createdAt.toISOString(),
      author_id: mockProblem.authorId,
      class_id: mockProblem.classId,
    };

    it('should get problems by author', async () => {
      const selectEq = jest.fn().mockResolvedValue({ data: [mockMetadataRow], error: null });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      const result = await repository.getByAuthor('author-456');

      expect(selectEq).toHaveBeenCalledWith('author_id', 'author-456');
      expect(result).toHaveLength(1);
      expect(result[0].authorName).toBe('author-456');
    });

    it('should get problems by author with namespace filter', async () => {
      const secondEq = jest.fn().mockResolvedValue({ data: [mockMetadataRow], error: null });
      const firstEq = jest.fn().mockReturnValue({ eq: secondEq });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: firstEq,
        }),
      });

      const result = await repository.getByAuthor('author-456', undefined, 'stanford');

      expect(firstEq).toHaveBeenCalledWith('author_id', 'author-456');
      expect(result).toHaveLength(1);
    });

    it('should return empty array if author has no problems', async () => {
      const selectEq = jest.fn().mockResolvedValue({ data: [], error: null });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      const result = await repository.getByAuthor('unknown-author');

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      const selectEq = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      await expect(repository.getByAuthor('author-456')).rejects.toThrow(
        'Failed to get problems by author: Query failed'
      );
    });
  });

  describe('getByClass', () => {
    const mockMetadataRow = {
      id: mockProblem.id,
      namespace_id: mockProblem.namespaceId,
      title: mockProblem.title,
      test_cases: mockProblem.testCases,
      created_at: mockProblem.createdAt.toISOString(),
      author_id: mockProblem.authorId,
      class_id: mockProblem.classId,
    };

    it('should get problems by class', async () => {
      const selectEq = jest.fn().mockResolvedValue({ data: [mockMetadataRow], error: null });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      const result = await repository.getByClass('class-789');

      expect(selectEq).toHaveBeenCalledWith('class_id', 'class-789');
      expect(result).toHaveLength(1);
    });

    it('should get problems by class with namespace filter', async () => {
      const secondEq = jest.fn().mockResolvedValue({ data: [mockMetadataRow], error: null });
      const firstEq = jest.fn().mockReturnValue({ eq: secondEq });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: firstEq,
        }),
      });

      const result = await repository.getByClass('class-789', undefined, 'stanford');

      expect(firstEq).toHaveBeenCalledWith('class_id', 'class-789');
      expect(result).toHaveLength(1);
    });

    it('should return empty array if class has no problems', async () => {
      const selectEq = jest.fn().mockResolvedValue({ data: [], error: null });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      const result = await repository.getByClass('unknown-class');

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      const selectEq = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Query failed' },
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: selectEq,
        }),
      });

      await expect(repository.getByClass('class-789')).rejects.toThrow(
        'Failed to get problems by class: Query failed'
      );
    });
  });

  describe('duplicate', () => {
    it('should duplicate a problem with new title', async () => {
      // First call: getById
      const getByIdSingle = jest.fn().mockResolvedValue({ data: mockProblemRow, error: null });
      const getByIdEq = jest.fn().mockReturnValue({ single: getByIdSingle });

      // Second call: create (insert)
      const duplicatedRow = {
        ...mockProblemRow,
        id: 'new-uuid-5678',
        title: 'Duplicated Problem',
      };
      const insertSingle = jest.fn().mockResolvedValue({ data: duplicatedRow, error: null });
      const insertSelect = jest.fn().mockReturnValue({ single: insertSingle });
      const insertFn = jest.fn().mockReturnValue({ select: insertSelect });

      let callCount = 0;
      mockFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            select: jest.fn().mockReturnValue({ eq: getByIdEq }),
          };
        } else {
          return {
            insert: insertFn,
          };
        }
      });

      const result = await repository.duplicate(mockProblem.id, 'Duplicated Problem');

      expect(result.title).toBe('Duplicated Problem');
      expect(result.id).toBe('new-uuid-5678');
      expect(result.namespaceId).toBe(mockProblem.namespaceId);
      expect(result.authorId).toBe(mockProblem.authorId);
    });

    it('should throw error if original problem not found', async () => {
      const getByIdSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });
      const getByIdEq = jest.fn().mockReturnValue({ single: getByIdSingle });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({ eq: getByIdEq }),
      });

      await expect(repository.duplicate('nonexistent', 'New Title')).rejects.toThrow(
        'Problem not found: nonexistent'
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
