/**
 * Tests for POST /api/sessions/[id]/execute route
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getSessionManager } from '@/server/session-manager';
import { executeCodeSafe } from '@/server/code-executor';
import { Session } from '@/server/types';
import { Problem, ExecutionSettings } from '@/server/types/problem';

// Mock dependencies
jest.mock('@/server/auth/api-auth');
jest.mock('@/server/session-manager');
jest.mock('@/server/code-executor');

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetSessionManager = getSessionManager as jest.MockedFunction<typeof getSessionManager>;
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
    participants: [],
    status: 'active',
    sectionId: 'section-1',
    sectionName: 'Test Section',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully execute code', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      getStudentData: jest.fn().mockResolvedValue({
        code: 'print("Hello")',
        executionSettings: undefined,
      }),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

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
    expect(mockExecuteCodeSafe).toHaveBeenCalledWith({
      code: 'print("Hello")',
      executionSettings: {
        stdin: 'default stdin',
        randomSeed: 42,
      },
    });
  });

  it('should merge execution settings (student overrides session)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const studentSettings: ExecutionSettings = {
      stdin: 'student stdin',
      randomSeed: 999,
    };

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      getStudentData: jest.fn().mockResolvedValue({
        code: 'print("Hello")',
        executionSettings: studentSettings,
      }),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

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
    expect(mockExecuteCodeSafe).toHaveBeenCalledWith({
      code: 'print("Hello")',
      executionSettings: studentSettings,
    });
  });

  it('should use payload settings if provided (highest priority)', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const studentSettings: ExecutionSettings = {
      stdin: 'student stdin',
      randomSeed: 999,
    };

    const payloadSettings: ExecutionSettings = {
      stdin: 'payload stdin',
      randomSeed: 555,
    };

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      getStudentData: jest.fn().mockResolvedValue({
        code: 'print("Hello")',
        executionSettings: studentSettings,
      }),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

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
    expect(mockExecuteCodeSafe).toHaveBeenCalledWith({
      code: 'print("Hello")',
      executionSettings: payloadSettings,
    });
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

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(null),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

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

  it('should return 500 on execution error', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      getStudentData: jest.fn().mockResolvedValue({
        code: 'print("Hello")',
        executionSettings: undefined,
      }),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

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
});
