/**
 * Tests for POST /api/sessions/[id]/execute route
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { executeCodeSafe } from '@/server/code-executor';
import { Session } from '@/server/types';
import { Problem, ExecutionSettings } from '@/server/types/problem';

// Mock dependencies
jest.mock('@/server/auth/api-auth');
jest.mock('@/server/persistence', () => ({
  getStorage: jest.fn(),
}));
jest.mock('@/server/services/session-service', () => ({
  getStudentData: jest.fn(),
}));
jest.mock('@/server/code-executor');

import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;
const mockExecuteCodeSafe = executeCodeSafe as jest.MockedFunction<typeof executeCodeSafe>;

describe('POST /api/sessions/[id]/execute', () => {
  const mockUser = {
    id: 'user-1',
    email: 'student@example.com',
    username: 'student',
    role: 'student' as const,
    namespaceId: 'default',
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  const mockProblem: Problem = {
    id: 'prob-1',
    namespaceId: 'default',
    title: 'Test Problem',
    description: 'Test description',
    starterCode: 'print("Hello")',
    testCases: [],
    executionSettings: {
      stdin: 'default stdin',
      randomSeed: 42,
    },
    authorId: 'user-1',
    classId: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockSession: Session = {
    id: 'session-1',
    namespaceId: 'default',
    problem: mockProblem,
    students: new Map(),
    createdAt: new Date(),
    lastActivity: new Date(),
    creatorId: 'instructor-1',
    participants: ['user-1'], // Include mockUser as participant
    status: 'active',
    sectionId: 'section-1',
    sectionName: 'Test Section',
  };

  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = {
      sessions: {
        getSession: jest.fn(),
      },
    };
    mockGetStorage.mockResolvedValue(mockStorage);
  });

  it('should successfully execute code', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);
    (SessionService.getStudentData as jest.Mock).mockReturnValue({
      code: 'print("Hello")',
      executionSettings: undefined,
    });

    const mockResult = {
      success: true,
      output: 'Hello\n',
      error: '',
      executionTime: 100,
    };

    mockExecuteCodeSafe.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockResult);
    expect(mockExecuteCodeSafe).toHaveBeenCalledWith(
      {
        code: 'print("Hello")',
        executionSettings: {
          stdin: 'default stdin',
          randomSeed: 42,
        },
      },
      undefined, // default timeout
      'session-1' // sessionId
    );
  });

  it('should merge execution settings (student overrides session)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);

    const studentSettings: ExecutionSettings = {
      stdin: 'student stdin',
      randomSeed: 999,
    };

    (SessionService.getStudentData as jest.Mock).mockReturnValue({
      code: 'print("Hello")',
      executionSettings: studentSettings,
    });

    const mockResult = {
      success: true,
      output: 'Hello\n',
      error: '',
      executionTime: 100,
    };

    mockExecuteCodeSafe.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    expect(mockExecuteCodeSafe).toHaveBeenCalledWith(
      {
        code: 'print("Hello")',
        executionSettings: studentSettings,
      },
      undefined, // default timeout
      'session-1' // sessionId
    );
  });

  it('should use payload settings if provided (highest priority)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);

    const studentSettings: ExecutionSettings = {
      stdin: 'student stdin',
      randomSeed: 999,
    };

    const payloadSettings: ExecutionSettings = {
      stdin: 'payload stdin',
      randomSeed: 555,
    };

    (SessionService.getStudentData as jest.Mock).mockReturnValue({
      code: 'print("Hello")',
      executionSettings: studentSettings,
    });

    const mockResult = {
      success: true,
      output: 'Hello\n',
      error: '',
      executionTime: 100,
    };

    mockExecuteCodeSafe.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("Hello")',
        executionSettings: payloadSettings,
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    expect(mockExecuteCodeSafe).toHaveBeenCalledWith(
      {
        code: 'print("Hello")',
        executionSettings: payloadSettings,
      },
      undefined, // default timeout
      'session-1' // sessionId
    );
  });

  it('should return 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('should return 400 when code is missing', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Code is required');
  });

  it('should return 400 when studentId is missing', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Student ID is required');
  });

  it('should return 404 when session not found', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('should return 400 when session is closed', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue({
      ...mockSession,
      status: 'completed',
    });

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Session is closed. Code execution is no longer available.');
    expect(mockExecuteCodeSafe).not.toHaveBeenCalled();
  });

  it('should return 500 on execution error', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);
    (SessionService.getStudentData as jest.Mock).mockReturnValue({
      code: 'print("Hello")',
      executionSettings: undefined,
    });

    mockExecuteCodeSafe.mockRejectedValue(new Error('Execution failed'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to execute code');
  });

  describe('Security: participant authorization', () => {
    it('should return 403 when user is not a participant or creator', async () => {
      const nonParticipantUser = {
        ...mockUser,
        id: 'other-user-id',
      };
      mockGetAuthenticatedUser.mockResolvedValue(nonParticipantUser);

      // Session where user is neither creator nor participant
      const restrictedSession = {
        ...mockSession,
        creatorId: 'instructor-1',
        participants: ['student-1', 'student-2'],
      };
      mockStorage.sessions.getSession.mockResolvedValue(restrictedSession);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          code: 'print("Hello")',
        }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Access denied. You are not a participant in this session.');
      expect(mockExecuteCodeSafe).not.toHaveBeenCalled();
    });

    it('should allow execution when user is the session creator (instructor)', async () => {
      // Note: Creator must be instructor role, not student
      const creatorUser = {
        ...mockUser,
        id: 'instructor-1',
        role: 'instructor' as const, // SECURITY: Instructor role required to execute other students' code
      };
      mockGetAuthenticatedUser.mockResolvedValue(creatorUser);

      // Session where user is the creator but not in participants list
      const creatorSession = {
        ...mockSession,
        creatorId: 'instructor-1',
        participants: ['student-1'],
      };
      mockStorage.sessions.getSession.mockResolvedValue(creatorSession);
      (SessionService.getStudentData as jest.Mock).mockReturnValue({
        code: 'print("Hello")',
        executionSettings: undefined,
      });

      const mockResult = {
        success: true,
        output: 'Hello\n',
        error: '',
        executionTime: 100,
      };
      mockExecuteCodeSafe.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1',
          code: 'print("Hello")',
        }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(mockExecuteCodeSafe).toHaveBeenCalled();
    });

    it('should allow student participant to execute their own code', async () => {
      // SECURITY FIX: Students can only execute their own code
      const participantUser = {
        ...mockUser,
        id: 'student-1',
        role: 'student' as const,
      };
      mockGetAuthenticatedUser.mockResolvedValue(participantUser);

      // Session where user is a participant
      const participantSession = {
        ...mockSession,
        creatorId: 'instructor-1',
        participants: ['student-1', 'student-2'],
      };
      mockStorage.sessions.getSession.mockResolvedValue(participantSession);
      (SessionService.getStudentData as jest.Mock).mockReturnValue({
        code: 'print("Hello")',
        executionSettings: undefined,
      });

      const mockResult = {
        success: true,
        output: 'Hello\n',
        error: '',
        executionTime: 100,
      };
      mockExecuteCodeSafe.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1', // SECURITY: Student executing their OWN code
          code: 'print("Hello")',
        }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(mockExecuteCodeSafe).toHaveBeenCalled();
    });
  });

  describe('Security: student code ownership', () => {
    it('should return 403 when student tries to execute code for another student', async () => {
      const studentUser = {
        ...mockUser,
        id: 'student-1',
        role: 'student' as const,
      };
      mockGetAuthenticatedUser.mockResolvedValue(studentUser);

      // Session where both students are participants
      const sessionWithBothStudents = {
        ...mockSession,
        creatorId: 'instructor-1',
        participants: ['student-1', 'student-2'],
      };
      mockStorage.sessions.getSession.mockResolvedValue(sessionWithBothStudents);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-2', // Trying to execute code for another student
          code: 'print("Hello")',
        }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: You can only execute your own code');
      expect(mockExecuteCodeSafe).not.toHaveBeenCalled();
    });

    it('should allow student to execute their own code', async () => {
      const studentUser = {
        ...mockUser,
        id: 'student-1',
        role: 'student' as const,
      };
      mockGetAuthenticatedUser.mockResolvedValue(studentUser);

      const sessionWithStudent = {
        ...mockSession,
        creatorId: 'instructor-1',
        participants: ['student-1'],
      };
      mockStorage.sessions.getSession.mockResolvedValue(sessionWithStudent);
      (SessionService.getStudentData as jest.Mock).mockReturnValue({
        code: 'print("Hello")',
        executionSettings: undefined,
      });

      const mockResult = {
        success: true,
        output: 'Hello\n',
        error: '',
        executionTime: 100,
      };
      mockExecuteCodeSafe.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1', // Executing their own code
          code: 'print("Hello")',
        }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(mockExecuteCodeSafe).toHaveBeenCalled();
    });

    it('should allow instructor to execute code for any student', async () => {
      const instructorUser = {
        ...mockUser,
        id: 'instructor-1',
        role: 'instructor' as const,
      };
      mockGetAuthenticatedUser.mockResolvedValue(instructorUser);

      const sessionAsCreator = {
        ...mockSession,
        creatorId: 'instructor-1',
        participants: ['student-1'],
      };
      mockStorage.sessions.getSession.mockResolvedValue(sessionAsCreator);
      (SessionService.getStudentData as jest.Mock).mockReturnValue({
        code: 'print("Hello")',
        executionSettings: undefined,
      });

      const mockResult = {
        success: true,
        output: 'Hello\n',
        error: '',
        executionTime: 100,
      };
      mockExecuteCodeSafe.mockResolvedValue(mockResult);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/execute', {
        method: 'POST',
        body: JSON.stringify({
          studentId: 'student-1', // Instructor executing student's code
          code: 'print("Hello")',
        }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(mockExecuteCodeSafe).toHaveBeenCalled();
    });
  });
});
