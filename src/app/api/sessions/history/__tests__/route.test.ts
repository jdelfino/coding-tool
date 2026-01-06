import { NextRequest, NextResponse } from 'next/server';
import { GET } from '../route';
import { sessionManagerHolder } from '@/server/session-manager';
import type { User } from '@/server/auth/types';
import { RBACService } from '@/server/auth/rbac';

// Mock dependencies
jest.mock('@/server/auth/api-helpers', () => ({
  requireAuth: jest.fn(),
  getNamespaceContext: jest.fn((req: any, user: any) => user.namespaceId || 'default'),
}));
jest.mock('@/server/session-manager');

import { requireAuth } from '@/server/auth/api-helpers';

// Test helper to create mock auth context
function createAuthContext(user: User) {
  return {
    user,
    sessionId: 'test-session',
    rbac: new RBACService(user),
  };
}

describe('GET /api/sessions/history', () => {
  const mockUser: User = {
    id: 'user-1',
    username: 'instructor',
        email: "test@example.com",
      email: "test@example.com",
    role: 'instructor' as const,
    namespaceId: 'default',
    createdAt: new Date('2024-01-01'),
  };

  const mockStudentUser: User = {
    id: 'user-2',
    username: 'student',
        email: "test@example.com",
    role: 'student' as const,
    namespaceId: 'default',
    createdAt: new Date('2024-01-01'),
  };

  const mockActiveSessions = [
    {
      id: 'session-1',
      joinCode: 'ABC123',
      problem: {
        id: 'problem-1',
        title: 'Test Problem 1',
        description: 'Test description',
        starterCode: '',
        testCases: [],
        authorId: 'user-1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      students: new Map(),
      createdAt: new Date('2024-01-01T10:00:00Z'),
      lastActivity: new Date('2024-01-01T10:30:00Z'),
      creatorId: 'user-1',
      participants: ['user-2', 'user-3'],
      status: 'active' as const,
      sectionId: 'section-1',
      sectionName: 'Section A',
    },
  ];

  const mockCompletedSessions = [
    {
      id: 'session-2',
      joinCode: 'XYZ789',
      problem: undefined,
      students: new Map(),
      createdAt: new Date('2024-01-01T09:00:00Z'),
      lastActivity: new Date('2024-01-01T09:45:00Z'),
      creatorId: 'user-1',
      participants: ['user-2'],
      status: 'completed' as const,
      endedAt: new Date('2024-01-01T09:45:00Z'),
      sectionId: 'section-2',
      sectionName: 'Section B',
    },
  ];

  const mockAllSessions = [...mockActiveSessions, ...mockCompletedSessions];

  let mockAuth: any;
  let mockSessionManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuth = createAuthContext(mockUser);

    mockSessionManager = {
      getSessionsByCreator: jest.fn(),
      getSessionsByParticipant: jest.fn(),
    };

    sessionManagerHolder.instance = mockSessionManager;
  });

  it('returns 401 if not authenticated', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    );

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns all sessions for instructor without filters', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(mockAllSessions);

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions[0].id).toBe('session-1'); // Most recent first
    expect(data.sessions[1].id).toBe('session-2');
  });

  it('filters by status=active', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(mockAllSessions);

    const request = new NextRequest('http://localhost/api/sessions/history?status=active');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].status).toBe('active');
    expect(data.sessions[0].id).toBe('session-1');
  });

  it('filters by status=completed', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(mockAllSessions);

    const request = new NextRequest('http://localhost/api/sessions/history?status=completed');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].status).toBe('completed');
    expect(data.sessions[0].id).toBe('session-2');
  });

  it('filters by search query (section name)', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(mockAllSessions);

    const request = new NextRequest('http://localhost/api/sessions/history?search=section%20b');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].sectionName).toBe('Section B');
  });

  it('filters by search query (problem title)', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(mockAllSessions);

    const request = new NextRequest('http://localhost/api/sessions/history?search=section');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toHaveLength(2); // Both have 'section' in sectionName
  });

  it('combines status and search filters', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(mockAllSessions);

    const request = new NextRequest('http://localhost/api/sessions/history?status=active&search=section%20a');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].status).toBe('active');
    expect(data.sessions[0].sectionName).toBe('Section A');
  });

  it('returns sessions for students (viewOwn permission)', async () => {
    const studentAuth = createAuthContext(mockStudentUser);

    (requireAuth as jest.Mock).mockResolvedValue(studentAuth);
    studentAuth.rbac.hasPermission = jest.fn().mockImplementation((user: any, permission: string) => {
      return permission === 'session.viewOwn';
    });
    mockSessionManager.getSessionsByParticipant.mockResolvedValue([mockActiveSessions[0]]);

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toHaveLength(1);
    expect(mockSessionManager.getSessionsByParticipant).toHaveBeenCalledWith('user-2');
  });

  it('returns 403 if user has no session view permissions', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(false);

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Forbidden');
  });

  it('sorts sessions by lastActivity descending', async () => {
    const unsortedSessions = [
      {
        ...mockCompletedSessions[0],
        lastActivity: new Date('2024-01-01T08:00:00Z'),
      },
      {
        ...mockActiveSessions[0],
        lastActivity: new Date('2024-01-01T12:00:00Z'),
      },
    ];

    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(unsortedSessions);

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toHaveLength(2);
    // Most recent activity first
    expect(data.sessions[0].id).toBe('session-1');
    expect(data.sessions[1].id).toBe('session-2');
  });

  it('serializes session data correctly', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue([mockActiveSessions[0]]);

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    const session = data.sessions[0];

    expect(session.id).toBe('session-1');
    expect(session.problemTitle).toBe('Test Problem 1');
    expect(session.participantCount).toBe(2);
    expect(session.status).toBe('active');
    expect(session.sectionName).toBe('Section A');
    expect(session.sectionId).toBe('section-1');
    expect(typeof session.createdAt).toBe('string');
    expect(typeof session.lastActivity).toBe('string');
  });

  it('handles sessions without problems', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue([mockCompletedSessions[0]]);

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions[0].problemTitle).toBe('Untitled Session');
    expect(data.sessions[0].problemDescription).toBeUndefined();
  });

  it('handles errors gracefully', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });

  it('returns empty array when no sessions found', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toEqual([]);
  });

  it('returns empty array when all sessions filtered out', async () => {
    const auth = createAuthContext(mockUser);
    (requireAuth as jest.Mock).mockResolvedValue(auth);
    auth.rbac.hasPermission = jest.fn().mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(mockAllSessions);

    const request = new NextRequest('http://localhost/api/sessions/history?search=nonexistent');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toEqual([]);
  });
});
