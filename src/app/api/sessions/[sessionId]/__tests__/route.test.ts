/**
 * Tests for DELETE /api/sessions/:sessionId route
 *
 * These are unit tests for the HTTP layer - they mock session-service
 * to test route behavior (auth, validation, error handling).
 */

import { NextRequest } from 'next/server';
import { DELETE } from '../route';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';

jest.mock('@/server/auth/api-auth');
jest.mock('@/server/persistence');
jest.mock('@/server/services/session-service');

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;

describe('DELETE /api/sessions/:sessionId', () => {
  const mockInstructor = {
    id: 'instructor-1',
    username: 'instructor',
    email: 'instructor@test.com',
    role: 'instructor' as const,
    namespaceId: 'default',
    createdAt: new Date(),
  };

  const mockOtherInstructor = {
    id: 'instructor-2',
    username: 'other-instructor',
    email: 'other@test.com',
    role: 'instructor' as const,
    namespaceId: 'default',
    createdAt: new Date(),
  };

  const mockAdmin = {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@test.com',
    role: 'namespace-admin' as const,
    namespaceId: 'default',
    createdAt: new Date(),
  };

  const mockCodingSession = {
    id: 'session-1',
    sectionId: 'section-1',
    sectionName: 'Section A',
    status: 'active' as const,
    createdAt: new Date(),
    creatorId: 'instructor-1',
    participants: ['instructor-1'],
    students: new Map(),
    lastActivity: new Date(),
    namespaceId: 'default',
    problem: {} as any,
  };

  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {
      sessions: {
        getSession: jest.fn().mockResolvedValue(mockCodingSession),
      },
    };

    mockGetStorage.mockResolvedValue(mockStorage);

    // Default service mock
    (SessionService.endSession as jest.Mock).mockResolvedValue(undefined);
  });

  it('ends session when user is creator', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Session ended successfully');
    expect(SessionService.endSession).toHaveBeenCalledWith(mockStorage, 'session-1');
  });

  it('ends session when user is admin', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockAdmin);

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when session does not exist', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockStorage.sessions.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('returns 403 when user is not the creator', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockOtherInstructor);

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Only the session creator or admin');
  });

  it('returns 500 when service fails', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    (SessionService.endSession as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to end session');
    expect(data.details).toBe('Database error');
  });
});
