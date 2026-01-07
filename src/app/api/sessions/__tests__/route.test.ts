import { NextRequest, NextResponse } from 'next/server';
import { GET, POST } from '../route';
import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';
import type { User } from '@/server/auth/types';
import { RBACService } from '@/server/auth/rbac';

jest.mock('@/server/persistence');
jest.mock('@/server/services/session-service');

jest.mock('@/server/auth/api-helpers', () => ({
  requireAuth: jest.fn(),
  getNamespaceContext: jest.fn((req: any, user: any) => user.namespaceId || 'default'),
}));

import { requireAuth } from '@/server/auth/api-helpers';

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
    email: 'test@example.com',
    role: 'instructor' as const,
    namespaceId: 'default',
    createdAt: new Date('2024-01-01'),
  };

  const mockSection = {
    id: 'section-1',
    classId: 'class-1',
    name: 'Section A',
    namespaceId: 'default',
    joinCode: 'ABC123',
    instructorIds: ['user-1'],
    createdAt: new Date('2024-01-01'),
  };

  const mockSession = {
    id: 'session-1',
    sectionId: 'section-1',
    sectionName: 'Section A',
    namespaceId: 'default',
    students: new Map(),
    createdAt: new Date(),
    lastActivity: new Date(),
    creatorId: 'user-1',
    participants: [],
    status: 'active' as const,
    problem: { id: 'p1', title: 'Test', namespaceId: 'default', description: '', starterCode: '', authorId: 'user-1', createdAt: new Date(), updatedAt: new Date() },
  };

  const mockProblem = {
    id: 'problem-1',
    namespaceId: 'default',
    title: 'Test Problem',
    description: 'Test description',
    starterCode: 'def test():\n    pass',
    authorId: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
  };

  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {
      sessions: {
        createSession: jest.fn(),
        listAllSessions: jest.fn().mockResolvedValue([]),
      },
      sections: {
        getSection: jest.fn().mockResolvedValue(mockSection),
      },
      memberships: {
        getMembership: jest.fn().mockResolvedValue({ role: 'instructor' }),
      },
      problems: {
        getById: jest.fn().mockResolvedValue(mockProblem),
      },
    };

    (getStorage as jest.Mock).mockResolvedValue(mockStorage);
  });

  it('creates a session without a problem', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    (SessionService.createSession as jest.Mock).mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: 'section-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.success).toBe(true);
    expect(data.session.id).toBe('session-1');
    expect(data.session.joinCode).toBe('ABC123');
    expect(SessionService.createSession).toHaveBeenCalledWith(
      mockStorage, 'user-1', 'section-1', 'default'
    );
  });

  it('creates a session with a problem', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    (SessionService.createSessionWithProblem as jest.Mock).mockResolvedValue({
      ...mockSession,
      problem: mockProblem,
    });

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: 'section-1', problemId: 'problem-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(201);
    expect(data.session.problem.id).toBe('problem-1');
    expect(SessionService.createSessionWithProblem).toHaveBeenCalledWith(
      mockStorage, 'user-1', 'section-1', 'default', 'problem-1'
    );
  });

  it('returns 401 when not authenticated', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    );

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: 'section-1' }),
    });

    const response = await POST(request);
    expect(response.status).toBe(401);
  });

  it('returns 403 when user is not an instructor', async () => {
    const studentUser: User = { ...mockUser, role: 'student' };
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(studentUser));

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
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
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: 'nonexistent' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Section not found');
  });

  it('returns 404 when problem does not exist', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    mockStorage.problems.getById.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: 'section-1', problemId: 'nonexistent' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Problem not found');
  });

  it('returns 400 when user already has an active session', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    (SessionService.createSession as jest.Mock).mockRejectedValue(
      new Error('Cannot create session: User already has 1 active session(s).')
    );

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sectionId: 'section-1' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Cannot create session');
  });

  it('returns 403 when user is not an instructor in the section', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockUser));
    mockStorage.sections.getSection.mockResolvedValue({
      ...mockSection,
      instructorIds: ['other-instructor'],
    });
    mockStorage.memberships.getMembership.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sessions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
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
    email: 'test@example.com',
    role: 'instructor' as const,
    namespaceId: 'default',
    createdAt: new Date('2024-01-01'),
  };

  const mockStudent: User = {
    id: 'student-1',
    username: 'student',
    email: 'student@example.com',
    role: 'student' as const,
    namespaceId: 'default',
    createdAt: new Date('2024-01-01'),
  };

  const mockSessions = [
    {
      id: 'session-1',
      sectionId: 'section-1',
      sectionName: 'Section A',
      status: 'active' as const,
      createdAt: new Date('2024-01-01'),
      creatorId: 'instructor-1',
      participants: ['instructor-1', 'student-1'],
      problem: { id: 'problem-1', title: 'Test Problem 1', description: 'Description 1' },
    },
    {
      id: 'session-2',
      sectionId: 'section-2',
      sectionName: 'Section B',
      status: 'completed' as const,
      createdAt: new Date('2024-01-02'),
      endedAt: new Date('2024-01-03'),
      creatorId: 'instructor-1',
      participants: ['instructor-1'],
      problem: undefined,
    },
  ];

  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {
      sessions: {
        listAllSessions: jest.fn().mockResolvedValue(mockSessions),
      },
    };

    (getStorage as jest.Mock).mockResolvedValue(mockStorage);
  });

  it('returns sessions created by instructor', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockInstructor));

    const request = new NextRequest('http://localhost/api/sessions', { method: 'GET' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.sessions).toHaveLength(2);
  });

  it('returns sessions joined by student', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockStudent));
    mockStorage.sessions.listAllSessions.mockResolvedValue([
      ...mockSessions,
      { id: 'session-3', participants: ['other-student'], status: 'active', creatorId: 'x' },
    ]);

    const request = new NextRequest('http://localhost/api/sessions', { method: 'GET' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    // Student-1 is in session-1, not session-2 or session-3
    expect(data.sessions).toHaveLength(1);
    expect(data.sessions[0].id).toBe('session-1');
  });

  it('filters by status', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(createAuthContext(mockInstructor));
    mockStorage.sessions.listAllSessions.mockResolvedValue([mockSessions[0]]);

    const request = new NextRequest('http://localhost/api/sessions?status=active', { method: 'GET' });
    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(mockStorage.sessions.listAllSessions).toHaveBeenCalledWith(
      expect.objectContaining({ active: true })
    );
  });

  it('returns 401 when not authenticated', async () => {
    (requireAuth as jest.Mock).mockResolvedValue(
      NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    );

    const request = new NextRequest('http://localhost/api/sessions', { method: 'GET' });
    const response = await GET(request);

    expect(response.status).toBe(401);
  });
});
