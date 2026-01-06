/**
 * Tests for POST /api/sessions/[id]/join route
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getSessionManager } from '@/server/session-manager';
import { Session } from '@/server/types';
import { Problem } from '@/server/types/problem';

// Mock dependencies
jest.mock('@/server/auth/api-auth');
jest.mock('@/server/session-manager');

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetSessionManager = getSessionManager as jest.MockedFunction<typeof getSessionManager>;

describe('POST /api/sessions/[id]/join', () => {
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
    executionSettings: undefined,
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

  it('should successfully join a session', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      addStudent: jest.fn().mockResolvedValue(true),
      getStudentData: jest.fn().mockResolvedValue(undefined), // First time joining
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        name: 'Alice',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.student).toEqual({
      id: 'user-1',
      name: 'Alice',
      code: 'print("Hello")', // Starter code from problem
      executionSettings: undefined,
    });
    expect(mockSessionManager.addStudent).toHaveBeenCalledWith('session-1', 'user-1', 'Alice');
  });

  it('should allow rejoining with existing code', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const existingCode = 'print("Existing code")';

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      addStudent: jest.fn().mockResolvedValue(true),
      getStudentData: jest.fn().mockResolvedValue({
        code: existingCode,
        executionSettings: undefined,
      }),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        name: 'Alice',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.student.code).toBe(existingCode);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        name: 'Alice',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('should return 400 when name is missing', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Student name is required');
  });

  it('should return 400 when name is too long', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const longName = 'A'.repeat(51); // Max is 50 characters

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        name: longName,
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Student name is too long (max 50 characters)');
  });

  it('should return 404 when session not found', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(null),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        name: 'Alice',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('should return 400 when session is completed', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const completedSession: Session = {
      ...mockSession,
      status: 'completed',
    };

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(completedSession),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        name: 'Alice',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('This session has ended and cannot be joined');
  });

  it('should return 500 when addStudent fails', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      addStudent: jest.fn().mockResolvedValue(false), // Failure
      getStudentData: jest.fn().mockResolvedValue(undefined),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        name: 'Alice',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to join session');
  });

  it('should use authenticated user ID if no studentId provided', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      addStudent: jest.fn().mockResolvedValue(true),
      getStudentData: jest.fn().mockResolvedValue(undefined),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({
        name: 'Alice',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.student.id).toBe('user-1'); // Uses authenticated user ID
    expect(data.student.name).toBe('Alice');
    expect(data.student.code).toBe('print("Hello")');
    expect(mockSessionManager.addStudent).toHaveBeenCalledWith('session-1', 'user-1', 'Alice');
  });
});
