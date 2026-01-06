import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '../route';
import { getAuthProvider } from '@/server/auth';
import { getSessionManager } from '@/server/session-manager';
import { getStorage } from '@/server/persistence';
import type { User } from '@/server/auth/types';
import { RBACService } from '@/server/auth/rbac';

// Mock dependencies
jest.mock('@/server/auth');
jest.mock('@/server/session-manager');
jest.mock('@/server/persistence');

jest.mock('@/server/auth/api-helpers', () => ({
  requireAuth: jest.fn(),
  getNamespaceContext: jest.fn((req: any, user: any) => user.namespaceId || 'default'),
}));

import { requireAuth } from '@/server/auth/api-helpers';

// Test helper to create mock auth context
function createAuthContext(user: User) {
  return {
    user,
    sessionId: 'test-session',
    rbac: new RBACService(user),
  };
}

describe('POST /api/sessions', () => {
  const mockUser: User = {
    id: 'user-1',
    username: 'instructor',
        email: "test@example.com",
      email: "test@example.com",
    role: 'instructor' as const,
    namespaceId: 'default',
    createdAt: new Date('2024-01-01'),
  };

  const mockSection = {
    id: 'section-1',
    classId: 'class-1',
    name: 'Section A',
    semester: 'Fall 2024',
    joinCode: 'ABC123',
    instructorIds: ['user-1'],
    createdAt: new Date('2024-01-01'),
  };

  const mockMembership = {
    id: 'membership-1',
    userId: 'user-1',
    sectionId: 'section-1',
    role: 'instructor' as const,
    joinedAt: new Date('2024-01-01'),
  };

  const mockSession = {
    id: 'session-1',
    joinCode: 'XYZ789',
    sectionId: 'section-1',
    sectionName: 'Section A',
    students: new Map(),
    createdAt: new Date(),
    lastActivity: new Date(),
    creatorId: 'user-1',
    participants: [],
    status: 'active' as const,
  };

  const mockProblem = {
    id: 'problem-1',
    title: 'Test Problem',
    description: 'Test description',
    starterCode: 'def test():\n    pass',
    testCases: [],
    authorId: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
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
      createSession: jest.fn(),
    };

    mockStorage = {
      sections: {
        getSection: jest.fn(),
      },
      memberships: {
        getMembership: jest.fn(),
      },
      problems: {
        getById: jest.fn(),
      },
    };

    (getAuthProvider as jest.Mock).mockResolvedValue(mockAuthProvider);
    (getSessionManager as jest.Mock).mockResolvedValue(mockSessionManager);
    (getStorage as jest.Mock).mockResolvedValue(mockStorage);
  });

  it('creates a session without a problem', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    mockStorage.sections.getSection.mockResolvedValue(mockSection);
    mockStorage.memberships.getMembership.mockResolvedValue(mockMembership);
    mockSessionManager.createSession.mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({ sectionId: 'section-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.session.id).toBe('session-1');
    expect(data.session.joinCode).toBe('ABC123'); // Section's join code
    expect(mockSessionManager.createSession).toHaveBeenCalledWith(
      'user-1',
      'section-1',
      'Section A',
      undefined
    );
  });

  it('creates a session with a problem', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    mockStorage.sections.getSection.mockResolvedValue(mockSection);
    mockStorage.memberships.getMembership.mockResolvedValue(mockMembership);
    mockStorage.problems.getById.mockResolvedValue(mockProblem);
    mockSessionManager.createSession.mockResolvedValue({
      ...mockSession,
      problem: mockProblem,
    });

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({ 
        sectionId: 'section-1',
        problemId: 'problem-1' 
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.session.problem).toBeDefined();
    expect(data.session.problem.id).toBe('problem-1');
    expect(data.session.problem.title).toBe('Test Problem');
    expect(mockSessionManager.createSession).toHaveBeenCalledWith(
      'user-1',
      'section-1',
      'Section A',
      mockProblem
    );
  });

  it('returns 401 when not authenticated', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    );

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ sectionId: 'section-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('returns 403 when user is not an instructor', async () => {
    const studentUser: User = { ...mockUser, role: 'student' };
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(studentUser));

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({ sectionId: 'section-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Only instructors');
  });

  it('returns 400 when sectionId is missing', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('sectionId is required');
  });

  it('returns 404 when section does not exist', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    mockStorage.sections.getSection.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({ sectionId: 'nonexistent' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Section not found');
  });

  it('returns 403 when user is not an instructor in the section', async () => {
    const sectionWithDifferentInstructor = {
      ...mockSection,
      instructorIds: ['other-instructor'], // User not in instructorIds
    };

    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    mockStorage.sections.getSection.mockResolvedValue(sectionWithDifferentInstructor);
    mockStorage.memberships.getMembership.mockResolvedValue({
      ...mockMembership,
      role: 'student', // And has student role
    });

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({ sectionId: 'section-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('must be an instructor');
  });

  it('returns 404 when problem does not exist', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    mockStorage.sections.getSection.mockResolvedValue(mockSection);
    mockStorage.memberships.getMembership.mockResolvedValue(mockMembership);
    mockStorage.problems.getById.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({ 
        sectionId: 'section-1',
        problemId: 'nonexistent' 
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Problem not found');
  });

  it('creates a session when user is in instructorIds but has no membership', async () => {
    // This tests the scenario where the instructor created the section
    // and is in instructorIds array but has no membership record
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    mockStorage.sections.getSection.mockResolvedValue(mockSection);
    mockStorage.memberships.getMembership.mockResolvedValue(null); // No membership
    mockSessionManager.createSession.mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({ sectionId: 'section-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.session.id).toBe('session-1');
  });

  it('creates a session when user has instructor membership but not in instructorIds', async () => {
    // Edge case: user has membership but not in instructorIds (shouldn't normally happen)
    const sectionWithoutUser = {
      ...mockSection,
      instructorIds: ['other-instructor'],
    };

    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    mockStorage.sections.getSection.mockResolvedValue(sectionWithoutUser);
    mockStorage.memberships.getMembership.mockResolvedValue(mockMembership);
    mockSessionManager.createSession.mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({ sectionId: 'section-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
  });

  it('returns 403 when user is neither in instructorIds nor has instructor membership', async () => {
    const sectionWithoutUser = {
      ...mockSection,
      instructorIds: ['other-instructor'],
    };

    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    mockStorage.sections.getSection.mockResolvedValue(sectionWithoutUser);
    mockStorage.memberships.getMembership.mockResolvedValue(null); // No membership

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({ sectionId: 'section-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('must be an instructor');
  });
});
describe('GET /api/sessions', () => {
  const mockInstructor: User = {
    id: 'instructor-1',
    username: 'instructor',
        email: "test@example.com",
    role: 'instructor' as const,
    namespaceId: 'default',
    createdAt: new Date('2024-01-01'),
  };

  const mockStudent: User = {
    id: 'student-1',
    username: 'student',
        email: "test@example.com",
    role: 'student' as const,
    namespaceId: 'default',
    createdAt: new Date('2024-01-01'),
  };

  const mockSessions = [
    {
      id: 'session-1',
      joinCode: 'ABC123',
      sectionId: 'section-1',
      sectionName: 'Section A',
      status: 'active' as const,
      createdAt: new Date('2024-01-01'),
      creatorId: 'instructor-1',
      participants: ['instructor-1', 'student-1'],
      students: new Map(),
      problem: {
        id: 'problem-1',
        title: 'Test Problem 1',
        description: 'Description 1',
        starterCode: 'def test():\n    pass',
        testCases: [],
        authorId: 'instructor-1',
        createdAt: new Date('2024-01-01'),
        updatedAt: new Date('2024-01-01'),
      },
      lastActivity: new Date('2024-01-01'),
    },
    {
      id: 'session-2',
      joinCode: 'DEF456',
      sectionId: 'section-2',
      sectionName: 'Section B',
      status: 'completed' as const,
      createdAt: new Date('2024-01-02'),
      endedAt: new Date('2024-01-03'),
      creatorId: 'instructor-1',
      participants: ['instructor-1'],
      students: new Map(),
      problem: undefined,
      lastActivity: new Date('2024-01-02'),
    },
    {
      id: 'session-3',
      joinCode: 'GHI789',
      sectionId: 'section-3',
      sectionName: 'Section C',
      status: 'active' as const,
      createdAt: new Date('2024-01-03'),
      creatorId: 'other-instructor',
      participants: ['other-instructor', 'student-1'],
      students: new Map(),
      problem: undefined,
      lastActivity: new Date('2024-01-03'),
    },
  ];

  let mockAuthProvider: any;
  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthProvider = {
      getSession: jest.fn(),
    };

    mockStorage = {
      sessions: {
        listAllSessions: jest.fn(),
      },
    };

    (getAuthProvider as jest.Mock).mockResolvedValue(mockAuthProvider);
    (getStorage as jest.Mock).mockResolvedValue(mockStorage);
  });

  it('returns sessions created by instructor', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockInstructor));
    mockStorage.sessions.listAllSessions.mockResolvedValue([mockSessions[0], mockSessions[1]]);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'GET',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions[0].id).toBe('session-1');
    expect(data.sessions[0].participantCount).toBe(2);
    expect(data.sessions[1].id).toBe('session-2');
    expect(mockStorage.sessions.listAllSessions).toHaveBeenCalledWith({
      instructorId: 'instructor-1',
      namespaceId: 'default',
    });
  });

  it('returns sessions joined by student', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockStudent));
    mockStorage.sessions.listAllSessions.mockResolvedValue(mockSessions);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'GET',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.sessions).toHaveLength(2);
    expect(data.sessions[0].id).toBe('session-1');
    expect(data.sessions[1].id).toBe('session-3');
  });

  it('filters by active status', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockInstructor));
    mockStorage.sessions.listAllSessions.mockResolvedValue([mockSessions[0]]);

    const request = new NextRequest('http://localhost/api/sessions?status=active', {
      method: 'GET',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].status).toBe('active');
    expect(mockStorage.sessions.listAllSessions).toHaveBeenCalledWith({
      instructorId: 'instructor-1',
      namespaceId: 'default',
      active: true,
    });
  });

  it('filters by completed status', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockInstructor));
    mockStorage.sessions.listAllSessions.mockResolvedValue([mockSessions[1]]);

    const request = new NextRequest('http://localhost/api/sessions?status=completed', {
      method: 'GET',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].status).toBe('completed');
    expect(mockStorage.sessions.listAllSessions).toHaveBeenCalledWith({
      instructorId: 'instructor-1',
      namespaceId: 'default',
      active: false,
    });
  });

  it('returns 401 when not authenticated', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    );

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'GET',
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('returns empty array when instructor has no sessions', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockInstructor));
    mockStorage.sessions.listAllSessions.mockResolvedValue([]);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'GET',
      headers: {
        Cookie: 'sessionId=test-session-id',
      },
    });

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.sessions).toHaveLength(0);
  });
});