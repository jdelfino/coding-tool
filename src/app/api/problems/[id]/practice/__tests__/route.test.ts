/**
 * Tests for /api/problems/[id]/practice endpoint
 *
 * Tests:
 * - POST /api/problems/[id]/practice - Find or create practice session
 *
 * Coverage:
 * - Authentication checks
 * - Section membership validation
 * - Problem existence validation
 * - Reuse existing completed sessions
 * - Create new session when none exists
 * - Add student to session
 * - Error handling
 */

import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import { createStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';
import { requireAuth } from '@/server/auth/api-helpers';
import type { User } from '@/server/auth/types';
import { RBACService } from '@/server/auth/rbac';
import { rateLimit } from '@/server/rate-limit';

// Mock dependencies
jest.mock('@/server/persistence');
jest.mock('@/server/services/session-service');
jest.mock('@/server/rate-limit');
jest.mock('@/server/auth/api-helpers', () => ({
  requireAuth: jest.fn(),
  getNamespaceContext: jest.fn((req: any, user: any) => user.namespaceId || 'default'),
}));

const mockCreateStorage = createStorage as jest.MockedFunction<typeof createStorage>;
const mockRequireAuth = requireAuth as jest.MockedFunction<typeof requireAuth>;
const mockRateLimit = rateLimit as jest.MockedFunction<typeof rateLimit>;

// Helper to create auth context
function createAuthContext(user: User) {
  return {
    user,
    accessToken: 'test-access-token',
    rbac: new RBACService(),
  };
}

describe('POST /api/problems/[id]/practice', () => {
  const mockUser: User = {
    id: 'student-1',
    email: 'student@test.com',
    displayName: 'Test Student',
    role: 'student' as const,
    namespaceId: 'default',
    createdAt: new Date('2025-01-01'),
  };

  const mockProblem = {
    id: 'problem-123',
    title: 'Test Problem',
    description: 'Test description',
    starterCode: 'def solution():\n    pass',
    testCases: [],
    authorId: 'instructor-1',
    classId: 'class-1',
    namespaceId: 'default',
    tags: [],
    createdAt: new Date('2025-01-01'),
    updatedAt: new Date('2025-01-01'),
  };

  const mockSection = {
    id: 'section-1',
    classId: 'class-1',
    name: 'Section A',
    namespaceId: 'default',
    joinCode: 'ABC123',
    active: true,
    createdAt: new Date('2025-01-01'),
  };

  const mockMembership = {
    id: 'membership-1',
    userId: 'student-1',
    sectionId: 'section-1',
    role: 'student' as const,
    createdAt: new Date('2025-01-01'),
  };

  const mockCompletedSession = {
    id: 'session-123',
    namespaceId: 'default',
    problem: mockProblem,
    students: new Map(),
    createdAt: new Date('2025-01-01'),
    lastActivity: new Date('2025-01-01'),
    creatorId: 'instructor-1',
    participants: [],
    status: 'completed' as const,
    sectionId: 'section-1',
    sectionName: 'Section A',
    endedAt: new Date('2025-01-01'),
  };

  let mockUserStorage: any;
  let mockServiceStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Default: rate limit passes (returns null)
    mockRateLimit.mockResolvedValue(null);

    // Setup mock storages
    mockUserStorage = {
      problems: {
        getById: jest.fn().mockResolvedValue(mockProblem),
      },
      memberships: {
        getMembership: jest.fn().mockResolvedValue(mockMembership),
      },
    };

    mockServiceStorage = {
      sessions: {
        listAllSessions: jest.fn().mockResolvedValue([]),
        getSession: jest.fn(),
      },
    };

    // First call returns user storage, subsequent calls return service storage
    mockCreateStorage.mockImplementation((token: string) => {
      if (token === 'test-access-token') {
        return Promise.resolve(mockUserStorage as any);
      }
      return Promise.resolve(mockServiceStorage as any);
    });
  });

  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    );

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('should return 400 when sectionId is missing', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('sectionId is required');
  });

  it('should return 404 when problem not found', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    mockUserStorage.problems.getById.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Problem not found');
  });

  it('should return 403 when user is not a member of the section', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    mockUserStorage.memberships.getMembership.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Not a member of this section');
  });

  it('should reuse existing completed session with same problem', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    // Mock existing completed session
    mockServiceStorage.sessions.listAllSessions.mockResolvedValue([mockCompletedSession]);

    // Mock addStudent
    const mockStudent = {
      userId: 'student-1',
      name: 'Test Student',
      code: mockProblem.starterCode,
      lastUpdate: new Date(),
    };
    jest.spyOn(SessionService, 'addStudent').mockResolvedValue(mockStudent);

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('session-123');

    // Should NOT create a new session
    expect(SessionService.createSessionWithProblem).not.toHaveBeenCalled();
    expect(SessionService.endSession).not.toHaveBeenCalled();

    // Should add student to existing session
    expect(SessionService.addStudent).toHaveBeenCalledWith(
      mockServiceStorage,
      mockCompletedSession,
      'student-1',
      'Test Student'
    );
  });

  it('should create new session when no completed session exists', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    // No existing sessions
    mockServiceStorage.sessions.listAllSessions.mockResolvedValue([]);

    // Mock session creation
    const newSession = { ...mockCompletedSession, status: 'active' as const };
    jest.spyOn(SessionService, 'createSessionWithProblem').mockResolvedValue(newSession);
    jest.spyOn(SessionService, 'endSession').mockResolvedValue(undefined);

    // Mock getSession to return completed session after ending
    const completedSession = { ...newSession, status: 'completed' as const };
    mockServiceStorage.sessions.getSession.mockResolvedValue(completedSession);

    // Mock addStudent
    const mockStudent = {
      userId: 'student-1',
      name: 'Test Student',
      code: mockProblem.starterCode,
      lastUpdate: new Date(),
    };
    jest.spyOn(SessionService, 'addStudent').mockResolvedValue(mockStudent);

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('session-123');

    // Should create session, end it, and add student
    expect(SessionService.createSessionWithProblem).toHaveBeenCalledWith(
      mockServiceStorage,
      'student-1',
      'section-1',
      'default',
      'problem-123'
    );
    expect(SessionService.endSession).toHaveBeenCalledWith(mockServiceStorage, 'session-123');
    expect(SessionService.addStudent).toHaveBeenCalledWith(
      mockServiceStorage,
      completedSession,
      'student-1',
      'Test Student'
    );
  });

  it('should find correct session when multiple completed sessions exist', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    // Mock multiple completed sessions with different problems
    const otherSession = {
      ...mockCompletedSession,
      id: 'session-other',
      problem: { ...mockProblem, id: 'other-problem' },
    };
    mockServiceStorage.sessions.listAllSessions.mockResolvedValue([
      otherSession,
      mockCompletedSession,
    ]);

    // Mock addStudent
    const mockStudent = {
      userId: 'student-1',
      name: 'Test Student',
      code: mockProblem.starterCode,
      lastUpdate: new Date(),
    };
    jest.spyOn(SessionService, 'addStudent').mockResolvedValue(mockStudent);

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessionId).toBe('session-123'); // Should find the matching session

    // Should use the correct session
    expect(SessionService.addStudent).toHaveBeenCalledWith(
      mockServiceStorage,
      mockCompletedSession,
      'student-1',
      'Test Student'
    );
  });

  it('should use displayName when available', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    mockServiceStorage.sessions.listAllSessions.mockResolvedValue([mockCompletedSession]);

    const mockStudent = {
      userId: 'student-1',
      name: 'Test Student',
      code: mockProblem.starterCode,
      lastUpdate: new Date(),
    };
    jest.spyOn(SessionService, 'addStudent').mockResolvedValue(mockStudent);

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    await POST(request, params);

    expect(SessionService.addStudent).toHaveBeenCalledWith(
      mockServiceStorage,
      mockCompletedSession,
      'student-1',
      'Test Student' // displayName
    );
  });

  it('should fall back to email when displayName is not available', async () => {
    const userWithoutDisplayName = { ...mockUser, displayName: undefined };
    mockRequireAuth.mockResolvedValue(createAuthContext(userWithoutDisplayName));

    mockServiceStorage.sessions.listAllSessions.mockResolvedValue([mockCompletedSession]);

    const mockStudent = {
      userId: 'student-1',
      name: 'student@test.com',
      code: mockProblem.starterCode,
      lastUpdate: new Date(),
    };
    jest.spyOn(SessionService, 'addStudent').mockResolvedValue(mockStudent);

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    await POST(request, params);

    expect(SessionService.addStudent).toHaveBeenCalledWith(
      mockServiceStorage,
      mockCompletedSession,
      'student-1',
      'student@test.com' // email fallback
    );
  });

  it('should fall back to "Student" when neither displayName nor email are available', async () => {
    const userWithoutName = { ...mockUser, displayName: undefined, email: '' };
    mockRequireAuth.mockResolvedValue(createAuthContext(userWithoutName));

    mockServiceStorage.sessions.listAllSessions.mockResolvedValue([mockCompletedSession]);

    const mockStudent = {
      userId: 'student-1',
      name: 'Student',
      code: mockProblem.starterCode,
      lastUpdate: new Date(),
    };
    jest.spyOn(SessionService, 'addStudent').mockResolvedValue(mockStudent);

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    await POST(request, params);

    expect(SessionService.addStudent).toHaveBeenCalledWith(
      mockServiceStorage,
      mockCompletedSession,
      'student-1',
      'Student' // final fallback
    );
  });

  it('should handle errors when creating session fails', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    mockServiceStorage.sessions.listAllSessions.mockResolvedValue([]);

    jest.spyOn(SessionService, 'createSessionWithProblem').mockRejectedValue(
      new Error('Failed to create session')
    );

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to create session');
  });

  it('should handle errors when adding student fails', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    mockServiceStorage.sessions.listAllSessions.mockResolvedValue([mockCompletedSession]);

    jest.spyOn(SessionService, 'addStudent').mockRejectedValue(
      new Error('Failed to add student')
    );

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await POST(request, params);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to add student');
  });

  it('should respect rate limiting', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    const rateLimitResponse = NextResponse.json(
      { error: 'Rate limit exceeded' },
      { status: 429 }
    );
    mockRateLimit.mockResolvedValue(rateLimitResponse);

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    const response = await POST(request, params);

    expect(response).toBe(rateLimitResponse);
    expect(mockRateLimit).toHaveBeenCalledWith('write', request, 'student-1');
  });

  it('should use service role storage for session operations', async () => {
    mockRequireAuth.mockResolvedValue(createAuthContext(mockUser));

    mockServiceStorage.sessions.listAllSessions.mockResolvedValue([]);

    const newSession = { ...mockCompletedSession, status: 'active' as const };
    jest.spyOn(SessionService, 'createSessionWithProblem').mockResolvedValue(newSession);
    jest.spyOn(SessionService, 'endSession').mockResolvedValue(undefined);

    const completedSession = { ...newSession, status: 'completed' as const };
    mockServiceStorage.sessions.getSession.mockResolvedValue(completedSession);

    const mockStudent = {
      userId: 'student-1',
      name: 'Test Student',
      code: mockProblem.starterCode,
      lastUpdate: new Date(),
    };
    jest.spyOn(SessionService, 'addStudent').mockResolvedValue(mockStudent);

    const request = new NextRequest('http://localhost/api/problems/problem-123/practice', {
      method: 'POST',
      body: JSON.stringify({ sectionId: 'section-1' }),
    });
    const params = { params: Promise.resolve({ id: 'problem-123' }) };

    await POST(request, params);

    // Verify service storage was used for session operations
    expect(mockServiceStorage.sessions.listAllSessions).toHaveBeenCalledWith({
      sectionId: 'section-1',
      active: false,
      namespaceId: 'default',
    });
    expect(SessionService.createSessionWithProblem).toHaveBeenCalledWith(
      mockServiceStorage,
      expect.any(String),
      expect.any(String),
      expect.any(String),
      expect.any(String)
    );
  });
});
