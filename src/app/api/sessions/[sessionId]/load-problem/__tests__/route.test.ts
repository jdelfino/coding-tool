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

jest.mock('@/server/persistence', () => ({
  getStorage: jest.fn(),
}));

jest.mock('@/server/session-manager', () => ({
  sessionManagerHolder: {
    instance: {
      getSession: jest.fn(),
      updateSessionProblem: jest.fn(),
    },
  },
}));

import { getAuthProvider } from '@/server/auth';
import { getStorage } from '@/server/persistence';
import { sessionManagerHolder } from '@/server/session-manager';
import type { User } from '@/server/auth/types';
import type { Problem } from '@/server/types/problem';
import type { Session } from '@/server/types';

describe('POST /api/sessions/:sessionId/load-problem', () => {
  const mockAuthProvider = {
    getSession: jest.fn(),
  };

  const mockStorage = {
    problems: {
      getById: jest.fn(),
    },
  };

  const mockInstructor: User = {
    id: 'instructor-1',
    username: 'teacher',
    role: 'instructor',
    createdAt: new Date('2025-01-01'),
  };

  const mockStudent: User = {
    id: 'student-1',
    username: 'learner',
    role: 'student',
    createdAt: new Date('2025-01-01'),
  };

  const mockProblem: Problem = {
    id: 'problem-123',
    title: 'FizzBuzz',
    description: 'Implement the FizzBuzz algorithm',
    starterCode: 'def fizzbuzz(n):\n    pass',
    testCases: [],
    authorId: 'instructor-1',
    isPublic: false,
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
    joinCode: 'ABC123',
    creatorId: 'instructor-1',
    students: new Map(),
    createdAt: new Date(),
    lastActivity: new Date(),
    problem: undefined,
    executionSettings: {
      stdin: '',
      randomSeed: undefined,
      attachedFiles: [],
    },
    participants: [],
    status: 'active',
    sectionId: 'section-1',
    sectionName: 'Test Section',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAuthProvider as jest.Mock).mockResolvedValue(mockAuthProvider);
    (getStorage as jest.Mock).mockResolvedValue(mockStorage);
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
      mockAuthProvider.getSession.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
      mockStorage.problems.getById.mockResolvedValue(mockProblem);
      (sessionManagerHolder.instance.getSession as jest.Mock).mockResolvedValue(mockSession);
      (sessionManagerHolder.instance.updateSessionProblem as jest.Mock).mockResolvedValue(true);

      // Execute
      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      // Verify
      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
      expect(data.message).toContain('FizzBuzz');
      
      expect(sessionManagerHolder.instance.updateSessionProblem).toHaveBeenCalledWith(
        'session-123',
        mockProblem,
        mockProblem.executionSettings
      );
    });

    it('should allow loading a public problem by any instructor', async () => {
      const publicProblem = { ...mockProblem, isPublic: true, authorId: 'other-instructor' };
      
      mockAuthProvider.getSession.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
      mockStorage.problems.getById.mockResolvedValue(publicProblem);
      (sessionManagerHolder.instance.getSession as jest.Mock).mockResolvedValue(mockSession);
      (sessionManagerHolder.instance.updateSessionProblem as jest.Mock).mockResolvedValue(true);

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      expect(response.status).toBe(200);
      const data = await response.json();
      expect(data.success).toBe(true);
    });
  });

  describe('Authentication errors', () => {
    it('should return 401 when no session cookie present', async () => {
      const headers = new Headers();
      const request = new NextRequest('http://localhost:3000/api/sessions/session-123/load-problem', {
        method: 'POST',
        headers,
        body: JSON.stringify({ problemId: 'problem-123' }),
      });

      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 401 when session is invalid', async () => {
      mockAuthProvider.getSession.mockResolvedValue(null);

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      expect(response.status).toBe(401);
      const data = await response.json();
      expect(data.error).toBe('Unauthorized');
    });

    it('should return 403 when user is not an instructor', async () => {
      mockAuthProvider.getSession.mockResolvedValue({
        id: 'auth-session-123',
        user: mockStudent,
      });

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('Only instructors');
    });
  });

  describe('Validation errors', () => {
    beforeEach(() => {
      mockAuthProvider.getSession.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
    });

    it('should return 400 when problemId is missing', async () => {
      const request = createRequest({});
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid problemId');
    });

    it('should return 400 when problemId is not a string', async () => {
      const request = createRequest({ problemId: 123 });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      expect(response.status).toBe(400);
      const data = await response.json();
      expect(data.error).toContain('Invalid problemId');
    });
  });

  describe('Not found errors', () => {
    beforeEach(() => {
      mockAuthProvider.getSession.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
    });

    it('should return 404 when session does not exist', async () => {
      (sessionManagerHolder.instance.getSession as jest.Mock).mockResolvedValue(null);

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'nonexistent' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Session not found');
    });

    it('should return 404 when problem does not exist', async () => {
      (sessionManagerHolder.instance.getSession as jest.Mock).mockResolvedValue(mockSession);
      mockStorage.problems.getById.mockResolvedValue(null);

      const request = createRequest({ problemId: 'nonexistent' });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      expect(response.status).toBe(404);
      const data = await response.json();
      expect(data.error).toBe('Problem not found');
    });
  });

  describe('Permission errors', () => {
    beforeEach(() => {
      mockAuthProvider.getSession.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
      (sessionManagerHolder.instance.getSession as jest.Mock).mockResolvedValue(mockSession);
    });

    it('should return 403 when instructor tries to access private problem of another instructor', async () => {
      const privateProblem = { 
        ...mockProblem, 
        isPublic: false, 
        authorId: 'other-instructor' 
      };
      mockStorage.problems.getById.mockResolvedValue(privateProblem);

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      expect(response.status).toBe(403);
      const data = await response.json();
      expect(data.error).toContain('do not have access');
    });
  });

  describe('Server errors', () => {
    beforeEach(() => {
      mockAuthProvider.getSession.mockResolvedValue({
        id: 'auth-session-123',
        user: mockInstructor,
      });
      (sessionManagerHolder.instance.getSession as jest.Mock).mockResolvedValue(mockSession);
      mockStorage.problems.getById.mockResolvedValue(mockProblem);
    });

    it('should return 500 when updateSessionProblem fails', async () => {
      (sessionManagerHolder.instance.updateSessionProblem as jest.Mock).mockResolvedValue(false);

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toContain('Failed to load problem');
    });

    it('should handle unexpected errors gracefully', async () => {
      (sessionManagerHolder.instance.updateSessionProblem as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      const request = createRequest({ problemId: 'problem-123' });
      const response = await POST(request, {
        params: Promise.resolve({ sessionId: 'session-123' }),
      });

      expect(response.status).toBe(500);
      const data = await response.json();
      expect(data.error).toBe('Internal server error');
    });
  });
});
