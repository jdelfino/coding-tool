/**
 * Unit tests for SupabaseSessionRepository
 *
 * Tests the session repository implementation against the Supabase backend.
 * Uses Jest mocks configured per-test for clean isolation.
 */

import { SupabaseSessionRepository } from '../session-repository';
import { Session, Student } from '../../../types';
import { Problem } from '../../../types/problem';
import { PersistenceErrorCode } from '../../types';

// Mock the Supabase client module
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockIn = jest.fn();
const mockSingle = jest.fn();
const mockLimit = jest.fn();
const mockOrder = jest.fn();
const mockRange = jest.fn();

jest.mock('../../../supabase/client', () => ({
  getSupabaseClientWithAuth: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('SupabaseSessionRepository', () => {
  let repository: SupabaseSessionRepository;

  const mockProblem: Problem = {
    id: 'problem-1',
    namespaceId: 'stanford',
    title: 'Hello World',
    description: 'Write a hello world program',
    starterCode: 'print("Hello")',
    authorId: 'instructor-1',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mockStudent: Student = {
    id: 'student-1',
    name: 'Alice',
    code: 'print("Hello World")',
    lastUpdate: new Date('2025-01-01T10:00:00Z'),
  };

  const mockSession: Session = {
    id: 'session-123',
    namespaceId: 'stanford',
    sectionId: 'section-1',
    sectionName: 'CS101 - Section A',
    problem: mockProblem,
    students: new Map([['student-1', mockStudent]]),
    createdAt: new Date('2025-01-01T00:00:00Z'),
    lastActivity: new Date('2025-01-01T10:00:00Z'),
    creatorId: 'instructor-1',
    participants: ['instructor-1', 'student-1'],
    status: 'active',
  };

  const mockSessionRow = {
    id: mockSession.id,
    namespace_id: mockSession.namespaceId,
    section_id: mockSession.sectionId,
    section_name: mockSession.sectionName,
    problem: mockProblem,
    featured_student_id: null,
    featured_code: null,
    created_at: mockSession.createdAt.toISOString(),
    last_activity: mockSession.lastActivity.toISOString(),
    creator_id: mockSession.creatorId,
    participants: mockSession.participants,
    status: mockSession.status,
    ended_at: null,
  };

  const mockStudentRow = {
    id: 'row-1',
    session_id: mockSession.id,
    student_id: mockStudent.id,
    name: mockStudent.name,
    code: mockStudent.code,
    last_update: mockStudent.lastUpdate.toISOString(),
    execution_settings: null,
    user_id: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock chain for common patterns
    mockFrom.mockImplementation(() => ({
      select: mockSelect.mockReturnValue({
        eq: mockEq.mockReturnValue({
          single: mockSingle,
          eq: mockEq,
          order: mockOrder.mockReturnValue({
            limit: mockLimit,
            range: mockRange,
          }),
        }),
        in: mockIn,
        limit: mockLimit,
        order: mockOrder.mockReturnValue({
          limit: mockLimit,
          range: mockRange,
        }),
      }),
      insert: mockInsert,
      update: mockUpdate.mockReturnValue({
        eq: mockEq,
      }),
      delete: mockDelete.mockReturnValue({
        eq: mockEq,
      }),
    }));

    repository = new SupabaseSessionRepository('test-token');
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
        'Failed to initialize SessionRepository: Connection failed'
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

  describe('createSession', () => {
    it('should create a new session with students', async () => {
      // Mock checking if session exists
      const mockExistingCheck = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });

      // Mock session insert
      const mockSessionInsert = jest.fn().mockResolvedValue({ data: null, error: null });

      // Mock student insert
      const mockStudentInsert = jest.fn().mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: mockExistingCheck,
              }),
            }),
            insert: mockSessionInsert,
          };
        }
        if (table === 'session_students') {
          return {
            insert: mockStudentInsert,
          };
        }
        return {};
      });

      const result = await repository.createSession(mockSession);

      expect(result).toBe(mockSession.id);
      expect(mockSessionInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          id: mockSession.id,
          namespace_id: mockSession.namespaceId,
          section_id: mockSession.sectionId,
          section_name: mockSession.sectionName,
          creator_id: mockSession.creatorId,
          status: 'active',
        })
      );
      expect(mockStudentInsert).toHaveBeenCalledWith([
        expect.objectContaining({
          session_id: mockSession.id,
          student_id: 'student-1',
          name: 'Alice',
          code: 'print("Hello World")',
        }),
      ]);
    });

    it('should create a session without students', async () => {
      const sessionWithoutStudents: Session = {
        ...mockSession,
        students: new Map(),
      };

      const mockExistingCheck = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      const mockSessionInsert = jest.fn().mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: mockExistingCheck,
              }),
            }),
            insert: mockSessionInsert,
          };
        }
        return {};
      });

      const result = await repository.createSession(sessionWithoutStudents);

      expect(result).toBe(sessionWithoutStudents.id);
      expect(mockSessionInsert).toHaveBeenCalled();
    });

    it('should throw ALREADY_EXISTS if session ID exists', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: { id: mockSession.id }, error: null }),
          }),
        }),
      });

      await expect(repository.createSession(mockSession)).rejects.toMatchObject({
        code: PersistenceErrorCode.ALREADY_EXISTS,
      });
    });

    it('should throw error on session insert failure', async () => {
      const mockExistingCheck = jest.fn().mockResolvedValue({ data: null, error: { code: 'PGRST116' } });
      const mockSessionInsert = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Insert failed' },
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: mockExistingCheck,
              }),
            }),
            insert: mockSessionInsert,
          };
        }
        return {};
      });

      await expect(repository.createSession(mockSession)).rejects.toThrow(
        'Failed to create session: Insert failed'
      );
    });
  });

  describe('getSession', () => {
    it('should get a session by ID with students', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: jest.fn().mockResolvedValue({ data: mockSessionRow, error: null }),
              }),
            }),
          };
        }
        if (table === 'session_students') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [mockStudentRow], error: null }),
            }),
          };
        }
        return {};
      });

      const result = await repository.getSession(mockSession.id);

      expect(result).not.toBeNull();
      expect(result!.id).toBe(mockSession.id);
      expect(result!.namespaceId).toBe(mockSession.namespaceId);
      expect(result!.students.size).toBe(1);
      expect(result!.students.get('student-1')?.name).toBe('Alice');
    });

    it('should return null if session not found', async () => {
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

      const result = await repository.getSession('nonexistent');

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

      await expect(repository.getSession(mockSession.id)).rejects.toThrow(
        'Failed to get session: Database error'
      );
    });
  });

  describe('updateSession', () => {
    it('should update session fields', async () => {
      const mockCheckExisting = jest.fn().mockResolvedValue({ data: { id: mockSession.id }, error: null });
      const mockUpdateResult = jest.fn().mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: mockCheckExisting,
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: mockUpdateResult,
            }),
          };
        }
        return {};
      });

      await repository.updateSession(mockSession.id, {
        status: 'completed',
        endedAt: new Date('2025-01-01T12:00:00Z'),
      });

      expect(mockFrom).toHaveBeenCalledWith('sessions');
    });

    it('should update session with new students', async () => {
      const mockCheckExisting = jest.fn().mockResolvedValue({ data: { id: mockSession.id }, error: null });
      const mockUpdateResult = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockDeleteResult = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockInsertResult = jest.fn().mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: mockCheckExisting,
              }),
            }),
            update: jest.fn().mockReturnValue({
              eq: mockUpdateResult,
            }),
          };
        }
        if (table === 'session_students') {
          return {
            delete: jest.fn().mockReturnValue({
              eq: mockDeleteResult,
            }),
            insert: mockInsertResult,
          };
        }
        return {};
      });

      const newStudents = new Map<string, Student>([
        ['student-2', { id: 'student-2', name: 'Bob', code: 'print("Hi")', lastUpdate: new Date() }],
      ]);

      await repository.updateSession(mockSession.id, { students: newStudents });

      expect(mockInsertResult).toHaveBeenCalledWith([
        expect.objectContaining({
          student_id: 'student-2',
          name: 'Bob',
        }),
      ]);
    });

    it('should throw NOT_FOUND if session does not exist', async () => {
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

      await expect(repository.updateSession('nonexistent', { status: 'completed' })).rejects.toMatchObject({
        code: PersistenceErrorCode.NOT_FOUND,
      });
    });
  });

  describe('deleteSession', () => {
    it('should delete a session and its students', async () => {
      const mockCheckExisting = jest.fn().mockResolvedValue({ data: { id: mockSession.id }, error: null });
      const mockStudentDelete = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockSessionDelete = jest.fn().mockResolvedValue({ data: null, error: null });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockReturnValue({
                single: mockCheckExisting,
              }),
            }),
            delete: jest.fn().mockReturnValue({
              eq: mockSessionDelete,
            }),
          };
        }
        if (table === 'session_students') {
          return {
            delete: jest.fn().mockReturnValue({
              eq: mockStudentDelete,
            }),
          };
        }
        return {};
      });

      await repository.deleteSession(mockSession.id);

      expect(mockStudentDelete).toHaveBeenCalled();
      expect(mockSessionDelete).toHaveBeenCalled();
    });

    it('should throw NOT_FOUND if session does not exist', async () => {
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

      await expect(repository.deleteSession('nonexistent')).rejects.toMatchObject({
        code: PersistenceErrorCode.NOT_FOUND,
      });
    });
  });

  describe('listActiveSessions', () => {
    it('should list all active sessions', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [mockSessionRow], error: null }),
            }),
          };
        }
        if (table === 'session_students') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [mockStudentRow], error: null }),
            }),
          };
        }
        return {};
      });

      const result = await repository.listActiveSessions();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(mockSession.id);
      expect(result[0].status).toBe('active');
    });

    it('should filter by namespace', async () => {
      const mockEqStatus = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [mockSessionRow], error: null }),
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: mockEqStatus,
            }),
          };
        }
        if (table === 'session_students') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [mockStudentRow], error: null }),
            }),
          };
        }
        return {};
      });

      const result = await repository.listActiveSessions('stanford');

      expect(result).toHaveLength(1);
    });

    it('should return empty array if no active sessions', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      const result = await repository.listActiveSessions();

      expect(result).toEqual([]);
    });
  });

  describe('listAllSessions', () => {
    it('should list all sessions with default sorting', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [mockSessionRow], error: null }),
            }),
          };
        }
        if (table === 'session_students') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [mockStudentRow], error: null }),
            }),
          };
        }
        return {};
      });

      const result = await repository.listAllSessions();

      expect(result).toHaveLength(1);
    });

    it('should apply filters', async () => {
      const mockOrderResult = jest.fn().mockReturnValue({
        limit: jest.fn().mockResolvedValue({ data: [mockSessionRow], error: null }),
      });
      const mockEqInstructor = jest.fn().mockReturnValue({
        order: mockOrderResult,
      });
      const mockEqStatus = jest.fn().mockReturnValue({
        eq: mockEqInstructor,
      });
      const mockEqNamespace = jest.fn().mockReturnValue({
        eq: mockEqStatus,
      });

      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              eq: mockEqNamespace,
            }),
          };
        }
        if (table === 'session_students') {
          return {
            select: jest.fn().mockReturnValue({
              in: jest.fn().mockResolvedValue({ data: [mockStudentRow], error: null }),
            }),
          };
        }
        return {};
      });

      const result = await repository.listAllSessions({
        namespaceId: 'stanford',
        active: true,
        instructorId: 'instructor-1',
        limit: 10,
        sortBy: 'createdAt',
        sortOrder: 'desc',
      });

      expect(result).toHaveLength(1);
    });

    it('should return empty array if no sessions', async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === 'sessions') {
          return {
            select: jest.fn().mockReturnValue({
              order: jest.fn().mockResolvedValue({ data: [], error: null }),
            }),
          };
        }
        return {};
      });

      const result = await repository.listAllSessions();

      expect(result).toEqual([]);
    });
  });

  describe('countSessions', () => {
    it('should count all sessions', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({ count: 5, error: null }),
      });

      const result = await repository.countSessions();

      expect(result).toBe(5);
    });

    it('should count with filters', async () => {
      const mockEqInstructor = jest.fn().mockResolvedValue({ count: 2, error: null });
      const mockEqStatus = jest.fn().mockReturnValue({
        eq: mockEqInstructor,
      });
      const mockEqNamespace = jest.fn().mockReturnValue({
        eq: mockEqStatus,
      });

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: mockEqNamespace,
        }),
      });

      const result = await repository.countSessions({
        namespaceId: 'stanford',
        active: true,
        instructorId: 'instructor-1',
      });

      expect(result).toBe(2);
    });

    it('should return 0 if count is null', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({ count: null, error: null }),
      });

      const result = await repository.countSessions();

      expect(result).toBe(0);
    });

    it('should throw error on count failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          count: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(repository.countSessions()).rejects.toThrow(
        'Failed to count sessions: Database error'
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
