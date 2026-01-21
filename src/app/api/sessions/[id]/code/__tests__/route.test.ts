/**
 * Tests for POST /api/sessions/[id]/code route
 *
 * These are unit tests for the HTTP layer - they mock session-service
 * to test route behavior (auth, validation, error handling).
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import { revisionBufferHolder } from '@/server/revision-buffer';
import * as SessionService from '@/server/services/session-service';
import { Session } from '@/server/types';
import { Problem } from '@/server/types/problem';

jest.mock('@/server/auth/api-auth');
jest.mock('@/server/persistence');
jest.mock('@/server/services/session-service');

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;

describe('POST /api/sessions/[id]/code', () => {
  const mockUser = {
    id: 'user-1',
    email: 'student@example.com',
    role: 'student' as const,
    namespaceId: 'default',
    createdAt: new Date(),
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
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const createMockSession = (): Session => ({
    id: 'session-1',
    namespaceId: 'default',
    problem: mockProblem,
    students: new Map([
      ['user-1', {
        id: 'user-1',
        name: 'Test Student',
        code: 'old code',
        lastUpdate: new Date(),
      }],
    ]),
    createdAt: new Date(),
    lastActivity: new Date(),
    creatorId: 'instructor-1',
    participants: ['user-1'],
    status: 'active',
    sectionId: 'section-1',
    sectionName: 'Test Section',
  });

  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {
      sessions: {
        getSession: jest.fn().mockResolvedValue(createMockSession()),
      },
    };

    mockGetStorage.mockResolvedValue(mockStorage);

    // Default service mock
    (SessionService.updateStudentCode as jest.Mock).mockResolvedValue(undefined);

    // Setup revision buffer mock
    revisionBufferHolder.instance = {
      addRevision: jest.fn().mockResolvedValue(undefined),
    } as any;
  });

  afterEach(() => {
    revisionBufferHolder.instance = null;
  });

  it('saves code successfully', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    const code = 'print("Updated code")';

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'user-1', code }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(SessionService.updateStudentCode).toHaveBeenCalledWith(
      mockStorage,
      expect.objectContaining({ id: 'session-1' }),
      'user-1',
      code,
      undefined
    );
    expect(revisionBufferHolder.instance!.addRevision).toHaveBeenCalledWith(
      'session-1', 'user-1', code, 'default'
    );
  });

  it('passes execution settings to service', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'user-1',
        code: 'print("code")',
        executionSettings: { stdin: 'custom stdin', randomSeed: 123 },
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    expect(SessionService.updateStudentCode).toHaveBeenCalledWith(
      mockStorage,
      expect.any(Object),
      'user-1',
      'print("code")',
      { stdin: 'custom stdin', randomSeed: 123 }
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'user-1', code: 'print("code")' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });

    expect(response.status).toBe(401);
  });

  it('returns 400 when code is missing', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'user-1' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Code is required');
  });

  it('returns 400 when studentId is missing', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({ code: 'print("code")' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Student ID is required');
  });

  it('returns 404 when session not found', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'user-1', code: 'print("code")' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('returns 400 when session is closed', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue({
      ...createMockSession(),
      status: 'completed',
    });

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'user-1', code: 'print("code")' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Session is closed. Code execution is no longer available.');
    expect(SessionService.updateStudentCode).not.toHaveBeenCalled();
  });

  it('returns 404 when student not found in session', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue({
      ...createMockSession(),
      students: new Map(),
    });

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'user-1', code: 'print("code")' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Student not found in session');
  });

  it('works without revision buffer', async () => {
    revisionBufferHolder.instance = null;
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'user-1', code: 'print("code")' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
  });

  it('returns 500 when service fails', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    (SessionService.updateStudentCode as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'user-1', code: 'print("code")' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to save code');
  });

  describe('Security: student ownership validation', () => {
    it('returns 403 when student tries to save code for another student', async () => {
      const studentUser = {
        ...mockUser,
        id: 'student-1',
        role: 'student' as const,
      };
      mockGetAuthenticatedUser.mockResolvedValue(studentUser);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
        method: 'POST',
        body: JSON.stringify({ studentId: 'other-student', code: 'print("code")' }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: You can only save your own code');
      expect(SessionService.updateStudentCode).not.toHaveBeenCalled();
    });

    it('allows student to save their own code', async () => {
      const studentUser = {
        ...mockUser,
        id: 'student-1',
        role: 'student' as const,
      };
      mockGetAuthenticatedUser.mockResolvedValue(studentUser);
      mockStorage.sessions.getSession.mockResolvedValue({
        ...createMockSession(),
        students: new Map([['student-1', { id: 'student-1', name: 'Student', code: '', lastUpdate: new Date() }]]),
      });

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
        method: 'POST',
        body: JSON.stringify({ studentId: 'student-1', code: 'print("code")' }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(SessionService.updateStudentCode).toHaveBeenCalled();
    });

    it('allows instructor to save code for any student', async () => {
      const instructorUser = {
        ...mockUser,
        id: 'instructor-1',
        role: 'instructor' as const,
      };
      mockGetAuthenticatedUser.mockResolvedValue(instructorUser);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
        method: 'POST',
        body: JSON.stringify({ studentId: 'user-1', code: 'print("code")' }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(SessionService.updateStudentCode).toHaveBeenCalled();
    });

    it('allows namespace-admin to save code for any student', async () => {
      const namespaceAdminUser = {
        ...mockUser,
        id: 'ns-admin-1',
        role: 'namespace-admin' as const,
      };
      mockGetAuthenticatedUser.mockResolvedValue(namespaceAdminUser);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
        method: 'POST',
        body: JSON.stringify({ studentId: 'user-1', code: 'print("code")' }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(SessionService.updateStudentCode).toHaveBeenCalled();
    });

    it('allows system-admin to save code for any student', async () => {
      const sysAdminUser = {
        ...mockUser,
        id: 'sys-admin-1',
        role: 'system-admin' as const,
      };
      mockGetAuthenticatedUser.mockResolvedValue(sysAdminUser);

      const request = new NextRequest('http://localhost:3000/api/sessions/session-1/code', {
        method: 'POST',
        body: JSON.stringify({ studentId: 'user-1', code: 'print("code")' }),
      });
      const params = Promise.resolve({ id: 'session-1' });

      const response = await POST(request, { params });

      expect(response.status).toBe(200);
      expect(SessionService.updateStudentCode).toHaveBeenCalled();
    });
  });
});
