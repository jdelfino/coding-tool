import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthProvider } from '@/server/auth';
import { getSessionManager } from '@/server/session-manager';
import { getStorage } from '@/server/persistence';

// Mock dependencies
jest.mock('@/server/auth');
jest.mock('@/server/session-manager');
jest.mock('@/server/persistence');

describe('POST /api/sessions', () => {
  const mockUser = {
    id: 'user-1',
    username: 'instructor',
    email: 'instructor@test.com',
    role: 'instructor' as const,
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
    solutionCode: '',
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
    mockAuthProvider.getSession.mockResolvedValue({ user: mockUser });
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
    expect(data.session.joinCode).toBe('XYZ789');
    expect(mockSessionManager.createSession).toHaveBeenCalledWith(
      'user-1',
      'section-1',
      'Section A',
      undefined
    );
  });

  it('creates a session with a problem', async () => {
    mockAuthProvider.getSession.mockResolvedValue({ user: mockUser });
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
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not an instructor', async () => {
    mockAuthProvider.getSession.mockResolvedValue({
      user: { ...mockUser, role: 'student' },
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
    expect(data.error).toContain('Only instructors');
  });

  it('returns 400 when sectionId is missing', async () => {
    mockAuthProvider.getSession.mockResolvedValue({ user: mockUser });

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
    mockAuthProvider.getSession.mockResolvedValue({ user: mockUser });
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
    
    mockAuthProvider.getSession.mockResolvedValue({ user: mockUser });
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
    mockAuthProvider.getSession.mockResolvedValue({ user: mockUser });
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
    mockAuthProvider.getSession.mockResolvedValue({ user: mockUser });
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
    
    mockAuthProvider.getSession.mockResolvedValue({ user: mockUser });
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
    
    mockAuthProvider.getSession.mockResolvedValue({ user: mockUser });
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
