/**
 * Unit tests for SupabaseRevisionRepository
 *
 * Tests the revision repository implementation against the Supabase backend.
 * Uses Jest mocks configured per-test for clean isolation.
 */

import { SupabaseRevisionRepository } from '../revision-repository';
import { CodeRevision, StoredRevision } from '../../types';

// Mock the Supabase client module
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockOrder = jest.fn();
const mockLimit = jest.fn();
const mockSingle = jest.fn();

jest.mock('../../../supabase/client', () => ({
  getSupabaseClientWithAuth: jest.fn(() => ({
    from: mockFrom,
  })),
}));

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'mock-uuid-123'),
}));

describe('SupabaseRevisionRepository', () => {
  let repository: SupabaseRevisionRepository;

  const mockRevision: CodeRevision = {
    id: 'rev-123',
    namespaceId: 'stanford',
    sessionId: 'session-456',
    studentId: 'student-789',
    timestamp: new Date('2025-01-05T10:30:00Z'),
    isDiff: false,
    fullCode: 'print("Hello World")',
    executionResult: {
      success: true,
      output: 'Hello World',
      error: '',
    },
  };

  const mockRevisionRow = {
    id: mockRevision.id,
    namespace_id: mockRevision.namespaceId,
    session_id: mockRevision.sessionId,
    student_id: mockRevision.studentId,
    timestamp: mockRevision.timestamp.toISOString(),
    is_diff: mockRevision.isDiff,
    diff: null,
    full_code: mockRevision.fullCode,
    base_revision_id: null,
    execution_result: mockRevision.executionResult,
  };

  const mockDiffRevision: CodeRevision = {
    id: 'rev-124',
    namespaceId: 'stanford',
    sessionId: 'session-456',
    studentId: 'student-789',
    timestamp: new Date('2025-01-05T10:31:00Z'),
    isDiff: true,
    diff: '@@ -1,5 +1,7 @@\n print\n-"Hello"\n+"Goodbye"\n',
    baseRevisionId: 'rev-123',
  };

  const mockDiffRevisionRow = {
    id: mockDiffRevision.id,
    namespace_id: mockDiffRevision.namespaceId,
    session_id: mockDiffRevision.sessionId,
    student_id: mockDiffRevision.studentId,
    timestamp: mockDiffRevision.timestamp.toISOString(),
    is_diff: mockDiffRevision.isDiff,
    diff: mockDiffRevision.diff,
    full_code: null,
    base_revision_id: mockDiffRevision.baseRevisionId,
    execution_result: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock chain for common patterns
    mockFrom.mockImplementation(() => {
      return {
        select: mockSelect.mockReturnValue({
          eq: mockEq.mockReturnValue({
            eq: mockEq.mockReturnValue({
              order: mockOrder.mockReturnValue({
                limit: mockLimit,
              }),
            }),
            order: mockOrder.mockReturnValue({
              limit: mockLimit,
            }),
            single: mockSingle,
          }),
          order: mockOrder,
          limit: mockLimit,
        }),
        insert: mockInsert,
        delete: jest.fn().mockReturnValue({
          eq: mockEq.mockReturnValue({
            eq: mockEq,
          }),
        }),
      };
    });

    repository = new SupabaseRevisionRepository('test-token');
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
        'Failed to initialize RevisionRepository: Connection failed'
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

  describe('saveRevision', () => {
    it('should save a new revision with full code', async () => {
      mockInsert.mockResolvedValue({ data: null, error: null });

      const result = await repository.saveRevision(mockRevision);

      expect(mockFrom).toHaveBeenCalledWith('revisions');
      expect(mockInsert).toHaveBeenCalledWith({
        id: mockRevision.id,
        namespace_id: mockRevision.namespaceId,
        session_id: mockRevision.sessionId,
        student_id: mockRevision.studentId,
        timestamp: mockRevision.timestamp.toISOString(),
        is_diff: mockRevision.isDiff,
        diff: null,
        full_code: mockRevision.fullCode,
        base_revision_id: null,
        execution_result: mockRevision.executionResult,
      });
      expect(result).toBe(mockRevision.id);
    });

    it('should save a diff revision', async () => {
      mockInsert.mockResolvedValue({ data: null, error: null });

      const result = await repository.saveRevision(mockDiffRevision);

      expect(mockInsert).toHaveBeenCalledWith({
        id: mockDiffRevision.id,
        namespace_id: mockDiffRevision.namespaceId,
        session_id: mockDiffRevision.sessionId,
        student_id: mockDiffRevision.studentId,
        timestamp: mockDiffRevision.timestamp.toISOString(),
        is_diff: true,
        diff: mockDiffRevision.diff,
        full_code: null,
        base_revision_id: mockDiffRevision.baseRevisionId,
        execution_result: null,
      });
      expect(result).toBe(mockDiffRevision.id);
    });

    it('should generate UUID if id not provided', async () => {
      mockInsert.mockResolvedValue({ data: null, error: null });

      const revisionWithoutId: CodeRevision = {
        ...mockRevision,
        id: '', // Empty id
      };

      const result = await repository.saveRevision(revisionWithoutId);

      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'mock-uuid-123',
        })
      );
      expect(result).toBe('mock-uuid-123');
    });

    it('should throw error on save failure', async () => {
      mockInsert.mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      await expect(repository.saveRevision(mockRevision)).rejects.toThrow(
        'Failed to save revision: Insert failed'
      );
    });
  });

  describe('getRevisions', () => {
    it('should get revisions for a student in a session (chronological order)', async () => {
      const rows = [mockRevisionRow, mockDiffRevisionRow];

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: rows, error: null }),
            }),
          }),
        }),
      });

      const result = await repository.getRevisions(
        mockRevision.sessionId,
        mockRevision.studentId
      );

      expect(mockFrom).toHaveBeenCalledWith('revisions');
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(mockRevision.id);
      expect(result[1].id).toBe(mockDiffRevision.id);
      // Verify chronological order
      expect(result[0].timestamp.getTime()).toBeLessThan(result[1].timestamp.getTime());
    });

    it('should filter by namespace when provided', async () => {
      const selectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [mockRevisionRow], error: null }),
            }),
          }),
        }),
      });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      await repository.getRevisions(
        mockRevision.sessionId,
        mockRevision.studentId,
        'stanford'
      );

      expect(mockFrom).toHaveBeenCalledWith('revisions');
    });

    it('should return empty array if no revisions found', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          }),
        }),
      });

      const result = await repository.getRevisions('session-123', 'student-456');

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({
                data: null,
                error: { message: 'Query failed' },
              }),
            }),
          }),
        }),
      });

      await expect(
        repository.getRevisions(mockRevision.sessionId, mockRevision.studentId)
      ).rejects.toThrow('Failed to get revisions: Query failed');
    });
  });

  describe('getRevision', () => {
    it('should get a revision by ID', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockRevisionRow, error: null }),
          }),
        }),
      });

      const result = await repository.getRevision(mockRevision.id);

      expect(mockFrom).toHaveBeenCalledWith('revisions');
      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockRevision.id);
      expect(result!.fullCode).toBe(mockRevision.fullCode);
    });

    it('should return null if revision not found', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'PGRST116', message: 'Not found' },
            }),
          }),
        }),
      });

      const result = await repository.getRevision('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: null,
              error: { code: 'OTHER', message: 'Database error' },
            }),
          }),
        }),
      });

      await expect(repository.getRevision(mockRevision.id)).rejects.toThrow(
        'Failed to get revision: Database error'
      );
    });
  });

  describe('getLatestRevision', () => {
    it('should get the latest revision for a student in a session', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: mockDiffRevisionRow,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await repository.getLatestRevision(
        mockRevision.sessionId,
        mockRevision.studentId
      );

      expect(mockFrom).toHaveBeenCalledWith('revisions');
      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockDiffRevision.id);
    });

    it('should return null if no revisions exist', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'PGRST116', message: 'Not found' },
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const result = await repository.getLatestRevision('session-123', 'student-456');

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              order: jest.fn().mockReturnValue({
                limit: jest.fn().mockReturnValue({
                  single: jest.fn().mockResolvedValue({
                    data: null,
                    error: { code: 'OTHER', message: 'Database error' },
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      await expect(
        repository.getLatestRevision(mockRevision.sessionId, mockRevision.studentId)
      ).rejects.toThrow('Failed to get latest revision: Database error');
    });
  });

  describe('deleteRevisions', () => {
    it('should delete all revisions for a session', async () => {
      const deleteEq = jest.fn().mockResolvedValue({ data: null, error: null });
      const deleteFn = jest.fn().mockReturnValue({
        eq: deleteEq,
      });

      mockFrom.mockReturnValue({
        delete: deleteFn,
      });

      await repository.deleteRevisions('session-456');

      expect(mockFrom).toHaveBeenCalledWith('revisions');
      expect(deleteFn).toHaveBeenCalled();
      expect(deleteEq).toHaveBeenCalledWith('session_id', 'session-456');
    });

    it('should delete revisions for a specific student in a session', async () => {
      const secondEq = jest.fn().mockResolvedValue({ data: null, error: null });
      const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
      const deleteFn = jest.fn().mockReturnValue({ eq: firstEq });

      mockFrom.mockReturnValue({
        delete: deleteFn,
      });

      await repository.deleteRevisions('session-456', 'student-789');

      expect(mockFrom).toHaveBeenCalledWith('revisions');
      expect(firstEq).toHaveBeenCalledWith('session_id', 'session-456');
      expect(secondEq).toHaveBeenCalledWith('student_id', 'student-789');
    });

    it('should throw error on delete failure', async () => {
      const deleteEq = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: deleteEq,
        }),
      });

      await expect(repository.deleteRevisions('session-456')).rejects.toThrow(
        'Failed to delete revisions: Delete failed'
      );
    });
  });

  describe('countRevisions', () => {
    it('should count revisions for a student in a session', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: 5, error: null }),
          }),
        }),
      });

      const result = await repository.countRevisions(
        mockRevision.sessionId,
        mockRevision.studentId
      );

      expect(mockFrom).toHaveBeenCalledWith('revisions');
      expect(result).toBe(5);
    });

    it('should return 0 if no revisions exist', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: 0, error: null }),
          }),
        }),
      });

      const result = await repository.countRevisions('session-123', 'student-456');

      expect(result).toBe(0);
    });

    it('should return 0 if count is null', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({ count: null, error: null }),
          }),
        }),
      });

      const result = await repository.countRevisions('session-123', 'student-456');

      expect(result).toBe(0);
    });

    it('should throw error on query failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockResolvedValue({
              count: null,
              error: { message: 'Count failed' },
            }),
          }),
        }),
      });

      await expect(
        repository.countRevisions(mockRevision.sessionId, mockRevision.studentId)
      ).rejects.toThrow('Failed to count revisions: Count failed');
    });
  });

  describe('getAllSessionRevisions', () => {
    it('should group revisions by student_id', async () => {
      const student1Rows = [mockRevisionRow, mockDiffRevisionRow];
      const student2Row = {
        ...mockRevisionRow,
        id: 'rev-999',
        student_id: 'student-other',
      };
      const allRows = [...student1Rows, student2Row];

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: allRows, error: null }),
          }),
        }),
      });

      const result = await repository.getAllSessionRevisions('session-456');

      expect(mockFrom).toHaveBeenCalledWith('revisions');
      expect(result.size).toBe(2);
      expect(result.get('student-789')).toHaveLength(2);
      expect(result.get('student-other')).toHaveLength(1);
    });

    it('should filter by namespace when provided', async () => {
      const eqMock = jest.fn().mockReturnValue({
        order: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: [mockRevisionRow], error: null }),
        }),
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: eqMock,
        }),
      });

      await repository.getAllSessionRevisions('session-456', 'stanford');

      expect(mockFrom).toHaveBeenCalledWith('revisions');
    });

    it('should return empty map if no revisions found', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({ data: [], error: null }),
          }),
        }),
      });

      const result = await repository.getAllSessionRevisions('session-456');

      expect(result.size).toBe(0);
    });

    it('should throw error on query failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            order: jest.fn().mockResolvedValue({
              data: null,
              error: { message: 'Query failed' },
            }),
          }),
        }),
      });

      await expect(repository.getAllSessionRevisions('session-456')).rejects.toThrow(
        'Failed to get all session revisions: Query failed'
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

  describe('mapRowToRevision', () => {
    it('should correctly map execution_result from JSONB', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockRevisionRow, error: null }),
          }),
        }),
      });

      const result = await repository.getRevision(mockRevision.id);

      expect(result!.executionResult).toEqual({
        success: true,
        output: 'Hello World',
        error: '',
      });
    });

    it('should handle null execution_result', async () => {
      const rowWithoutResult = {
        ...mockRevisionRow,
        execution_result: null,
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: rowWithoutResult, error: null }),
          }),
        }),
      });

      const result = await repository.getRevision(mockRevision.id);

      expect(result!.executionResult).toBeUndefined();
    });

    it('should create _metadata from timestamp', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: mockRevisionRow, error: null }),
          }),
        }),
      });

      const result = await repository.getRevision(mockRevision.id);

      expect(result!._metadata).toBeDefined();
      expect(result!._metadata!.createdAt).toEqual(mockRevision.timestamp);
      expect(result!._metadata!.updatedAt).toEqual(mockRevision.timestamp);
      expect(result!._metadata!.version).toBe(1);
    });
  });
});
