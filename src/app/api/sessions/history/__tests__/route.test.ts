import { NextRequest } from 'next/server';
import { GET } from '../route';
import { requireAuth } from '@/server/auth/api-helpers';
import { sessionManagerHolder } from '@/server/session-manager';

// Mock dependencies
jest.mock('@/server/auth/api-helpers');
jest.mock('@/server/session-manager');

describe('GET /api/sessions/history', () => {
  const mockUser = {
    id: 'user-1',
    username: 'instructor',
    email: 'instructor@test.com',
    role: 'instructor' as const,
    createdAt: new Date('2024-01-01'),
  };

  const mockStudentUser = {
    id: 'user-2',
    username: 'student',
    email: 'student@test.com',
    role: 'student' as const,
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
        solutionCode: '',
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

    mockAuth = {
      user: mockUser,
      rbac: {
        hasPermission: jest.fn(),
      },
    };

    mockSessionManager = {
      getSessionsByCreator: jest.fn(),
      getSessionsByParticipant: jest.fn(),
    };

    sessionManagerHolder.instance = mockSessionManager;
  });

  it('returns 401 if not authenticated', async () => {
    const { NextResponse } = await import('next/server');
    (requireAuth as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    );

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('returns all sessions for instructor without filters', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
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
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
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
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
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
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(mockAllSessions);

    const request = new NextRequest('http://localhost/api/sessions/history?search=section%20b');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].sectionName).toBe('Section B');
  });

  it('filters by search query (join code)', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(mockAllSessions);

    const request = new NextRequest('http://localhost/api/sessions/history?search=abc');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].joinCode).toBe('ABC123');
  });

  it('combines status and search filters', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
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
    const studentAuth = {
      user: mockStudentUser,
      rbac: {
        hasPermission: jest.fn(),
      },
    };
    
    (requireAuth as jest.Mock).mockResolvedValue(studentAuth);
    studentAuth.rbac.hasPermission.mockImplementation((user: any, permission: string) => {
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
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(false);

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

    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
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
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue([mockActiveSessions[0]]);

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    const session = data.sessions[0];
    
    expect(session.id).toBe('session-1');
    expect(session.joinCode).toBe('ABC123');
    expect(session.problemTitle).toBe('Test Problem 1');
    expect(session.participantCount).toBe(2);
    expect(session.status).toBe('active');
    expect(session.sectionName).toBe('Section A');
    expect(typeof session.createdAt).toBe('string');
    expect(typeof session.lastActivity).toBe('string');
  });

  it('handles sessions without problems', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue([mockCompletedSessions[0]]);

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions[0].problemTitle).toBe('Untitled Session');
    expect(data.sessions[0].problemDescription).toBeUndefined();
  });

  it('handles errors gracefully', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(500);
    const data = await response.json();
    expect(data.error).toBe('Internal server error');
  });

  it('returns empty array when no sessions found', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/sessions/history');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toEqual([]);
  });

  it('returns empty array when all sessions filtered out', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(mockAuth);
    mockAuth.rbac.hasPermission.mockReturnValue(true);
    mockSessionManager.getSessionsByCreator.mockResolvedValue(mockAllSessions);

    const request = new NextRequest('http://localhost/api/sessions/history?search=nonexistent');
    const response = await GET(request);

    expect(response.status).toBe(200);
    const data = await response.json();
    expect(data.sessions).toEqual([]);
  });
});
