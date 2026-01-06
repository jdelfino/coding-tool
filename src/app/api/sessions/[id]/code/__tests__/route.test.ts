/**
 * Tests for POST /api/sessions/[id]/code route
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getSessionManager } from '@/server/session-manager';
import { revisionBufferHolder } from '@/server/revision-buffer';
import { Session } from '@/server/types';
import { Problem, ExecutionSettings } from '@/server/types/problem';

// Mock dependencies
jest.mock('@/server/auth/api-auth');
jest.mock('@/server/session-manager');

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetSessionManager = getSessionManager as jest.MockedFunction<typeof getSessionManager>;

describe('POST /api/sessions/[id]/code', () => {
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

    // Mock revision buffer
    revisionBufferHolder.instance = {
      addRevision: jest.fn().mockResolvedValue(undefined),
    } as any;
  });

  afterEach(() => {
    revisionBufferHolder.instance = null;
  });

  it('should successfully save code', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      updateStudentCode: jest.fn().mockResolvedValue(true),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const code = 'print("Updated code")';

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code,
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSessionManager.updateStudentCode).toHaveBeenCalledWith('session-1', 'user-1', code);
    expect(revisionBufferHolder.instance!.addRevision).toHaveBeenCalledWith('session-1', 'user-1', code, 'default');
  });

  it('should update execution settings if provided', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      updateStudentCode: jest.fn().mockResolvedValue(true),
      updateStudentSettings: jest.fn().mockResolvedValue(undefined),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const code = 'print("Updated code")';
    const executionSettings: ExecutionSettings = {
      stdin: 'custom stdin',
      randomSeed: 123,
    };

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code,
        executionSettings,
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSessionManager.updateStudentSettings).toHaveBeenCalledWith('session-1', 'user-1', executionSettings);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("code")',
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

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
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

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("code")',
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

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("code")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('should return 500 when updateStudentCode fails', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      updateStudentCode: jest.fn().mockResolvedValue(false), // Failure
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("code")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to save code');
  });

  it('should work without revision buffer', async () => {
    // Remove revision buffer
    revisionBufferHolder.instance = null;

    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      updateStudentCode: jest.fn().mockResolvedValue(true),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const code = 'print("Updated code")';

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code,
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
