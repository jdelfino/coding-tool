/**
 * Tests for session-service
 */

import {
  createSession,
  createSessionWithProblem,
  addStudent,
  updateStudentCode,
  getStudentData,
  setFeaturedSubmission,
  clearFeaturedSubmission,
  endSession,
  cloneProblem,
  createEmptyProblem,
} from '../session-service';
import { Session } from '@/server/types';
import { Problem } from '@/server/types/problem';

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid'),
}));

describe('session-service', () => {
  // Mock storage
  const createMockStorage = () => ({
    sessions: {
      createSession: jest.fn().mockResolvedValue('session-id'),
      getSession: jest.fn(),
      updateSession: jest.fn().mockResolvedValue(undefined),
      listAllSessions: jest.fn().mockResolvedValue([]),
      deleteSession: jest.fn(),
      listActiveSessions: jest.fn(),
      countSessions: jest.fn(),
    },
    sections: {
      getSection: jest.fn().mockResolvedValue({
        id: 'section-1',
        name: 'Test Section',
        namespaceId: 'default',
        classId: 'class-1',
        joinCode: 'ABC123',
        active: true,
        createdAt: new Date(),
      }),
      listSections: jest.fn(),
      createSection: jest.fn(),
      updateSection: jest.fn(),
      deleteSection: jest.fn(),
    },
    problems: {
      getById: jest.fn(),
      list: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    users: {} as any,
    classes: {} as any,
    memberships: {} as any,
    revisions: {} as any,
  });

  describe('createSession', () => {
    it('creates a session with empty problem', async () => {
      const storage = createMockStorage();

      const session = await createSession(
        storage as any,
        'instructor-1',
        'section-1',
        'default'
      );

      expect(session.id).toBe('test-uuid');
      expect(session.creatorId).toBe('instructor-1');
      expect(session.sectionId).toBe('section-1');
      expect(session.status).toBe('active');
      expect(session.problem.title).toBe('Untitled Session');
      expect(storage.sessions.createSession).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid',
          creatorId: 'instructor-1',
        })
      );
    });

    it('throws if section not found', async () => {
      const storage = createMockStorage();
      storage.sections.getSection.mockResolvedValue(null);

      await expect(
        createSession(storage as any, 'instructor-1', 'bad-section', 'default')
      ).rejects.toThrow('Section bad-section not found');
    });

    it('enforces single active session per user', async () => {
      const storage = createMockStorage();
      storage.sessions.listAllSessions.mockResolvedValue([{ id: 'existing' }]);

      await expect(
        createSession(storage as any, 'instructor-1', 'section-1', 'default')
      ).rejects.toThrow('Cannot create session: User already has 1 active session');
    });
  });

  describe('createSessionWithProblem', () => {
    const mockProblem: Problem = {
      id: 'problem-1',
      namespaceId: 'default',
      title: 'Test Problem',
      description: 'Test',
      starterCode: 'print("hello")',
      testCases: [], // Test cases not relevant for these tests
      authorId: 'author-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    it('creates session with cloned problem', async () => {
      const storage = createMockStorage();
      storage.problems.getById.mockResolvedValue(mockProblem);

      const session = await createSessionWithProblem(
        storage as any,
        'instructor-1',
        'section-1',
        'default',
        'problem-1'
      );

      expect(session.problem.title).toBe('Test Problem');
      expect(session.problem.starterCode).toBe('print("hello")');
    });

    it('throws if problem not found', async () => {
      const storage = createMockStorage();
      storage.problems.getById.mockResolvedValue(null);

      await expect(
        createSessionWithProblem(
          storage as any,
          'instructor-1',
          'section-1',
          'default',
          'bad-problem'
        )
      ).rejects.toThrow('Problem bad-problem not found');
    });
  });

  describe('addStudent', () => {
    it('adds new student with starter code', async () => {
      const storage = createMockStorage();
      const session: Session = {
        id: 'session-1',
        namespaceId: 'default',
        problem: {
          id: 'prob-1',
          namespaceId: 'default',
          title: 'Test',
          description: '',
          starterCode: 'print("starter")',
          authorId: 'a',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        students: new Map(),
        participants: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        creatorId: 'instructor-1',
        status: 'active',
        sectionId: 'section-1',
        sectionName: 'Test',
      };

      const student = await addStudent(storage as any, session, 'student-1', 'Alice');

      expect(student.id).toBe('student-1');
      expect(student.name).toBe('Alice');
      expect(student.code).toBe('print("starter")');
      expect(session.students.has('student-1')).toBe(true);
      expect(session.participants).toContain('student-1');
    });

    it('preserves existing code on rejoin', async () => {
      const storage = createMockStorage();
      const session: Session = {
        id: 'session-1',
        namespaceId: 'default',
        problem: {
          id: 'prob-1',
          namespaceId: 'default',
          title: 'Test',
          description: '',
          starterCode: 'print("starter")',
          authorId: 'a',
          createdAt: new Date(),
          updatedAt: new Date(),
        },
        students: new Map([
          [
            'student-1',
            {
              id: 'student-1',
              name: 'Alice',
              code: 'print("my code")',
              lastUpdate: new Date(),
            },
          ],
        ]),
        participants: ['student-1'],
        createdAt: new Date(),
        lastActivity: new Date(),
        creatorId: 'instructor-1',
        status: 'active',
        sectionId: 'section-1',
        sectionName: 'Test',
      };

      const student = await addStudent(storage as any, session, 'student-1', 'Alice');

      expect(student.code).toBe('print("my code")'); // Preserved, not starter
    });
  });

  describe('getStudentData', () => {
    it('merges problem and student execution settings', () => {
      const session: Session = {
        id: 'session-1',
        namespaceId: 'default',
        problem: {
          id: 'prob-1',
          namespaceId: 'default',
          title: 'Test',
          description: '',
          starterCode: '',
          authorId: 'a',
          createdAt: new Date(),
          updatedAt: new Date(),
          executionSettings: {
            stdin: 'problem stdin',
            randomSeed: 42,
          },
        },
        students: new Map([
          [
            'student-1',
            {
              id: 'student-1',
              name: 'Alice',
              code: 'code',
              lastUpdate: new Date(),
              executionSettings: {
                randomSeed: 123, // Override
              },
            },
          ],
        ]),
        participants: ['student-1'],
        createdAt: new Date(),
        lastActivity: new Date(),
        creatorId: 'instructor-1',
        status: 'active',
        sectionId: 'section-1',
        sectionName: 'Test',
      };

      const data = getStudentData(session, 'student-1');

      expect(data?.code).toBe('code');
      expect(data?.executionSettings?.stdin).toBe('problem stdin'); // From problem
      expect(data?.executionSettings?.randomSeed).toBe(123); // Student override
    });

    it('returns undefined for unknown student', () => {
      const session: Session = {
        id: 'session-1',
        namespaceId: 'default',
        problem: {} as any,
        students: new Map(),
        participants: [],
        createdAt: new Date(),
        lastActivity: new Date(),
        creatorId: 'instructor-1',
        status: 'active',
        sectionId: 'section-1',
        sectionName: 'Test',
      };

      expect(getStudentData(session, 'unknown')).toBeUndefined();
    });
  });

  describe('cloneProblem', () => {
    it('creates deep copy of problem', () => {
      // Using type assertion since we're testing cloning behavior, not TestCase structure
      const original: Problem = {
        id: 'p1',
        namespaceId: 'default',
        title: 'Test',
        description: 'Desc',
        starterCode: 'code',
        testCases: [{ name: 'test1' }] as Problem['testCases'],
        executionSettings: {
          stdin: 'stdin',
          attachedFiles: [{ name: 'f.txt', content: 'c' }],
        },
        authorId: 'a',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const cloned = cloneProblem(original);

      // Should be equal but not same reference
      expect(cloned.title).toBe(original.title);
      expect(cloned.testCases).not.toBe(original.testCases);
      expect(cloned.executionSettings).not.toBe(original.executionSettings);
      expect(cloned.executionSettings?.attachedFiles).not.toBe(
        original.executionSettings?.attachedFiles
      );
    });
  });

  describe('endSession', () => {
    it('marks session as completed', async () => {
      const storage = createMockStorage();

      await endSession(storage as any, 'session-1');

      expect(storage.sessions.updateSession).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          status: 'completed',
          endedAt: expect.any(Date),
        })
      );
    });
  });
});
