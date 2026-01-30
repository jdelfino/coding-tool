/**
 * Unit tests for load-problem API endpoint
 * Tests POST /api/sessions/:sessionId/load-problem
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';

// Mock dependencies
jest.mock('@/server/auth', () => ({
  getAuthProvider: jest.fn(),
}));

jest.mock('@/server/persistence');
jest.mock('@/server/services/session-service');

import { getAuthProvider } from '@/server/auth';
import { createStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';
import type { User } from '@/server/auth/types';
import type { Problem } from '@/server/types/problem';
import type { Session } from '@/server/types';

const mockCreateStorage = createStorage as jest.MockedFunction<typeof createStorage>;

describe('POST /api/sessions/:sessionId/load-problem', () => {
  const mockAuthProvider = {
    getSessionFromRequest: jest.fn(),
  };

  const mockStorage = {
    problems: {
      getById: jest.fn(),
    },
    sessions: {
      getSession: jest.fn(),
    },
  };

  const mockInstructor: User = {
    id: 'instructor-1',
        email: "test@example.com",
    role: 'instructor',
    namespaceId: 'default',
    createdAt: new Date('2025-01-01'),
  };

  const mockStudent: User = {
    id: 'student-1',
        email: "test@example.com",
    role: 'student',
    namespaceId: 'default',
    createdAt: new Date('2025-01-01'),
  };

  const mockProblem: Problem = {
    id: 'problem-123',
    namespaceId: 'default',
    title: 'FizzBuzz',
    description: 'Implement the FizzBuzz algorithm',
    starterCode: 'def fizzbuzz(n):\n    pass',
    testCases: [],
    authorId: 'instructor-1',
    classId: 'test-class-id',
    tags: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
    executionSettings: {
      stdin: '',
      randomSeed: undefined,
      attachedFiles: [],
    },
  };

  const mockSession: Session = {
    id: 'session-123',
    namespaceId: 'default',
    creatorId: 'instructor-1',
    students: new Map(),
    createdAt: new Date(),
    lastActivity: new Date(),
    problem: {
      id: 'problem-456',
      namespaceId: 'default',
      title: 'Test Problem',
      description: 'Test description',
      starterCode: '',
      authorId: 'instructor-1',
      classId: 'test-class-id',
      tags: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      executionSettings: {
        stdin: '',
        randomSeed: undefined,
        attachedFiles: [],
      },
    },
    participants: [],
    status: 'active',
    sectionId: 'section-1',
    sectionName: 'Test Section',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthProvider as jest.Mock).mockResolvedValue(mockAuthProvider);
    mockCreateStorage.mockResolvedValue(mockStorage as any);
  });

  function createRequest(body: any, sessionId: string = 'session-123'): NextRequest {
    const headers = new Headers();
    headers.set('cookie', 'sessionId=auth-session-123');

    return new NextRequest('http://localhost:3000/api/sessions/' + sessionId + '/load-problem', {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });
  }

  describe('Success cases', () => {
    it('should successfully load a problem into a session', async () => {
      // Setup mocks
      mockAuthProvider.getSessionFromRequest.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
      mockStorage.problems.getById.mockResolvedValue(mockProblem);
      mockStorage.sessions.getSession.mockResolvedValue(mockSession);
      (SessionService.updateSessionProblem as jest.Mock).mockResolvedValue(undefined);

      // Execute
      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ id: 'session-123' }),
      });

      // Verify
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('FizzBuzz');

      expect(SessionService.updateSessionProblem).toHaveBeenCalledWith(
        mockStorage,
        'session-123',
        mockProblem,
        mockProblem.executionSettings
      );
    });

  });

  describe('Authentication errors', () => {
    it('should return 401 when no session cookie present', async () => {
      // Mock no authentication
      mockAuthProvider.getSessionFromRequest.mockResolvedValue(null);

      const headers = new Headers();
      const request = new NextRequest('http://localhost:3000/api/sessions/session-123/load-problem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ problemId: 'problem-123' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ id: 'session-123' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when session is invalid', async () => {
      mockAuthProvider.getSessionFromRequest.mockResolvedValue(null);

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ id: 'session-123' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not an instructor', async () => {
      mockAuthProvider.getSessionFromRequest.mockResolvedValue({
        id: 'auth-session-123',
        user: mockStudent,
      });

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ id: 'session-123' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Only instructors');
    });
  });

  describe('Validation errors', () => {
    beforeEach(() => {
      mockAuthProvider.getSessionFromRequest.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
    });

    it('should return 400 when problemId is missing', async () => {
      const request = createRequest({});
      const response = await POST(request, {
        params: Promise.resolve({ id: 'session-123' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid problemId');
    });

    it('should return 400 when problemId is not a string', async () => {
      const request = createRequest({ problemId: 123 });
      const response = await POST(request, {
        params: Promise.resolve({ id: 'session-123' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid problemId');
    });
  });

  describe('Not found errors', () => {
    beforeEach(() => {
      mockAuthProvider.getSessionFromRequest.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
    });

    it('should return 404 when session does not exist', async () => {
      mockStorage.sessions.getSession.mockResolvedValue(null);

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ id: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Session not found');
    });

    it('should return 404 when problem does not exist', async () => {
      mockStorage.sessions.getSession.mockResolvedValue(mockSession);
      mockStorage.problems.getById.mockResolvedValue(null);

      const request = createRequest({ problemId: 'nonexistent' });
      const response = await POST(request, {
        params: Promise.resolve({ id: 'session-123' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Problem not found');
    });
  });

  describe('Permission errors', () => {
    beforeEach(() => {
      mockAuthProvider.getSessionFromRequest.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
      mockStorage.sessions.getSession.mockResolvedValue(mockSession);
    });

    it('should return 403 when instructor tries to access private problem of another instructor', async () => {
      const privateProblem = {
        ...mockProblem,
        authorId: 'other-instructor'
      };
      mockStorage.problems.getById.mockResolvedValue(privateProblem);

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ id: 'session-123' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('do not have access');
    });
  });

  describe('Server errors', () => {
    beforeEach(() => {
      mockAuthProvider.getSessionFromRequest.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
      mockStorage.sessions.getSession.mockResolvedValue(mockSession);
      mockStorage.problems.getById.mockResolvedValue(mockProblem);
    });

    it('should handle unexpected errors gracefully', async () => {
      (SessionService.updateSessionProblem as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ id: 'session-123' }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});
