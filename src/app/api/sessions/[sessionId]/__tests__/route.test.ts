import { NextRequest } from 'next/server';
import { DELETE } from '../route';
import { getAuthProvider } from '@/server/auth';
import { getSessionManager } from '@/server/session-manager';
import { getStorage } from '@/server/persistence';

// Mock dependencies
jest.mock('@/server/auth');
jest.mock('@/server/session-manager');
jest.mock('@/server/persistence');

describe('DELETE /api/sessions/:sessionId', () => {
  const mockInstructor = {
    id: 'instructor-1',
    username: 'instructor',
    email: 'instructor@test.com',
    role: 'instructor' as const,
    createdAt: new Date('2024-01-01'),
  };

  const mockOtherInstructor = {
    id: 'instructor-2',
    username: 'other-instructor',
    email: 'other@test.com',
    role: 'instructor' as const,
    createdAt: new Date('2024-01-01'),
  };

  const mockAdmin = {
    id: 'admin-1',
    username: 'admin',
    email: 'admin@test.com',
    role: 'admin' as const,
    createdAt: new Date('2024-01-01'),
  };

  const mockCodingSession = {
    id: 'session-1',
    joinCode: 'ABC123',
    sectionId: 'section-1',
    sectionName: 'Section A',
    status: 'active' as const,
    createdAt: new Date('2024-01-01'),
    creatorId: 'instructor-1',
    participants: ['instructor-1'],
    students: new Map(),
    lastActivity: new Date('2024-01-01'),
  };

  let mockAuthProvider: any;
  let mockSessionManager: any;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthProvider = {
      getSession: jest.fn(),
    };

    mockSessionManager = {
      endSession: jest.fn(),
    };

    mockStorage = {
      sessions: {
        getSession: jest.fn(),
      },
    };

    (getAuthProvider as jest.Mock).mockResolvedValue(mockAuthProvider);
    (getSessionManager as jest.Mock).mockResolvedValue(mockSessionManager);
    (getStorage as jest.Mock).mockResolvedValue(mockStorage);
  });

  it('successfully ends session when user is creator', async () => {
    mockAuthProvider.getSession.mockResolvedValue({ user: mockInstructor });
    mockStorage.sessions.getSession.mockResolvedValue(mockCodingSession);
    mockSessionManager.endSession.mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Session ended successfully');
    expect(mockSessionManager.endSession).toHaveBeenCalledWith('session-1');
  });

  it('successfully ends session when user is admin', async () => {
    mockAuthProvider.getSession.mockResolvedValue({ user: mockAdmin });
    mockStorage.sessions.getSession.mockResolvedValue(mockCodingSession);
    mockSessionManager.endSession.mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('returns 401 when not authenticated', async () => {
    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 401 when session cookie is invalid', async () => {
    mockAuthProvider.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
      headers: {
        Cookie: 'sessionId=invalid-session',
      },
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 404 when session does not exist', async () => {
    mockAuthProvider.getSession.mockResolvedValue({ user: mockInstructor });
    mockStorage.sessions.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('returns 403 when user is not the creator', async () => {
    mockAuthProvider.getSession.mockResolvedValue({ user: mockOtherInstructor });
    mockStorage.sessions.getSession.mockResolvedValue(mockCodingSession);

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Only the session creator or admin');
  });

  it('returns 500 when endSession fails', async () => {
    mockAuthProvider.getSession.mockResolvedValue({ user: mockInstructor });
    mockStorage.sessions.getSession.mockResolvedValue(mockCodingSession);
    mockSessionManager.endSession.mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to end session');
  });

  it('handles exceptions gracefully', async () => {
    mockAuthProvider.getSession.mockResolvedValue({ user: mockInstructor });
    mockStorage.sessions.getSession.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/sessions/session-1', {
      method: 'DELETE',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await DELETE(request, { params: Promise.resolve({ sessionId: 'session-1' }) });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to end session');
    expect(data.details).toBe('Database error');
  });
});
