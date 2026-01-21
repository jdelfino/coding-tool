/**
 * Tests for DELETE /api/sessions/[id] route
 */

import { NextRequest } from 'next/server';
import { DELETE } from '../route';
import { getAuthenticatedUserWithToken } from '@/server/auth/api-auth';
import * as SessionService from '@/server/services/session-service';
import { getExecutorService } from '@/server/code-execution';
import { Session } from '@/server/types';
import { Problem } from '@/server/types/problem';

// Mock dependencies
jest.mock('@/server/auth/api-auth');
jest.mock('@/server/persistence', () => ({
  createStorage: jest.fn(),
}));
jest.mock('@/server/services/session-service');
jest.mock('@/server/code-execution');

import { createStorage } from '@/server/persistence';

const mockGetAuthenticatedUserWithToken = getAuthenticatedUserWithToken as jest.MockedFunction<typeof getAuthenticatedUserWithToken>;
const mockCreateStorage = createStorage as jest.MockedFunction<typeof createStorage>;
const mockEndSession = SessionService.endSession as jest.MockedFunction<typeof SessionService.endSession>;
const mockCleanupSession = jest.fn();
const mockGetExecutorService = getExecutorService as jest.MockedFunction<typeof getExecutorService>;
mockGetExecutorService.mockReturnValue({ cleanupSession: mockCleanupSession } as any);

describe('DELETE /api/sessions/[id]', () => {
  const mockUser = {
    id: 'instructor-1',
    email: 'instructor@example.com',
    role: 'instructor' as const,
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
    authorId: 'instructor-1',
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
    participants: ['student-1'],
    status: 'active',
    sectionId: 'section-1',
    sectionName: 'Test Section',
  };

  let mockStorage: {
    sessions: {
      getSession: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    // Re-setup mocks after clear
    mockGetExecutorService.mockReturnValue({ cleanupSession: mockCleanupSession } as any);
    mockStorage = {
      sessions: {
        getSession: jest.fn(),
      },
    };
    mockCreateStorage.mockResolvedValue(mockStorage as any);
    mockCleanupSession.mockResolvedValue(undefined);
  });

  it('should successfully end session and cleanup sandbox', async () => {
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);
    mockEndSession.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockEndSession).toHaveBeenCalledWith(mockStorage, 'session-1');
    expect(mockCleanupSession).toHaveBeenCalledWith('session-1');
  });

  it('should call cleanupSession after endSession', async () => {
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);

    const callOrder: string[] = [];
    mockEndSession.mockImplementation(async () => {
      callOrder.push('endSession');
    });
    mockCleanupSession.mockImplementation(async () => {
      callOrder.push('cleanupSession');
    });

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'session-1' });

    await DELETE(request, { params });

    expect(callOrder).toEqual(['endSession', 'cleanupSession']);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetAuthenticatedUserWithToken.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
    expect(mockCleanupSession).not.toHaveBeenCalled();
  });

  it('should return 404 when session not found', async () => {
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
    expect(mockCleanupSession).not.toHaveBeenCalled();
  });

  it('should return 403 when user is not creator or admin', async () => {
    const otherUser = {
      ...mockUser,
      id: 'other-user',
      role: 'instructor' as const,
    };
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: otherUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await DELETE(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Forbidden');
    expect(mockCleanupSession).not.toHaveBeenCalled();
  });

  it('should allow namespace-admin to end any session', async () => {
    const adminUser = {
      ...mockUser,
      id: 'admin-1',
      role: 'namespace-admin' as const,
    };
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: adminUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);
    mockEndSession.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await DELETE(request, { params });

    expect(response.status).toBe(200);
    expect(mockEndSession).toHaveBeenCalled();
    expect(mockCleanupSession).toHaveBeenCalledWith('session-1');
  });

  it('should allow system-admin to end any session', async () => {
    const adminUser = {
      ...mockUser,
      id: 'admin-1',
      role: 'system-admin' as const,
    };
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: adminUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);
    mockEndSession.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await DELETE(request, { params });

    expect(response.status).toBe(200);
    expect(mockEndSession).toHaveBeenCalled();
    expect(mockCleanupSession).toHaveBeenCalledWith('session-1');
  });

  it('should succeed even if cleanupSession is skipped locally', async () => {
    // In local development, cleanupSession is a no-op
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);
    mockEndSession.mockResolvedValue(undefined);
    mockCleanupSession.mockResolvedValue(undefined);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1', {
      method: 'DELETE',
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await DELETE(request, { params });

    expect(response.status).toBe(200);
    expect(mockEndSession).toHaveBeenCalled();
    expect(mockCleanupSession).toHaveBeenCalledWith('session-1');
  });
});
