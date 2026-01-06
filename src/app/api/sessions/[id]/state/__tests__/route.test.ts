/**
 * Tests for GET /api/sessions/[id]/state route
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getSessionManager } from '@/server/session-manager';
import { Session, Student } from '@/server/types';
import { Problem } from '@/server/types/problem';

// Mock dependencies
jest.mock('@/server/auth/api-auth');
jest.mock('@/server/session-manager');

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetSessionManager = getSessionManager as jest.MockedFunction<typeof getSessionManager>;

describe('GET /api/sessions/[id]/state', () => {
  const mockUser = {
    id: 'user-1',
    email: 'instructor@example.com',
    username: 'instructor',
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
    executionSettings: undefined,
    authorId: 'user-1',
    classId: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStudent1: Student = {
    id: 'student-1',
    name: 'Alice',
    code: 'print("Alice")',
    lastUpdate: new Date(),
    executionSettings: undefined,
  };

  const mockStudent2: Student = {
    id: 'student-2',
    name: 'Bob',
    code: 'print("Bob")',
    lastUpdate: new Date(),
    executionSettings: undefined,
  };

  const mockSession: Session = {
    id: 'session-1',
    namespaceId: 'default',
    problem: mockProblem,
    students: new Map([
      ['student-1', mockStudent1],
      ['student-2', mockStudent2],
    ]),
    createdAt: new Date(),
    lastActivity: new Date(),
    creatorId: 'user-1',
    participants: ['student-1', 'student-2'],
    status: 'active',
    sectionId: 'section-1',
    sectionName: 'Test Section',
    featuredStudentId: 'student-1',
    featuredCode: 'print("Featured")',
  };

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return session state for authenticated user', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      getStudents: jest.fn().mockResolvedValue([mockStudent1, mockStudent2]),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/state');
    const params = Promise.resolve({ id: 'session-1' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toHaveProperty('session');
    expect(data).toHaveProperty('students');
    expect(data).toHaveProperty('featuredStudent');

    expect(data.session.id).toBe('session-1');
    expect(data.students).toHaveLength(2);
    expect(data.featuredStudent).toEqual({
      studentId: 'student-1',
      code: 'print("Featured")',
    });
  });

  it('should return 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/state');
    const params = Promise.resolve({ id: 'session-1' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('should return 404 when session not found', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(null),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/state');
    const params = Promise.resolve({ id: 'session-1' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('should handle session with no featured student', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const sessionWithoutFeatured: Session = {
      ...mockSession,
      featuredStudentId: undefined,
      featuredCode: undefined,
    };

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(sessionWithoutFeatured),
      getStudents: jest.fn().mockResolvedValue([mockStudent1, mockStudent2]),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/state');
    const params = Promise.resolve({ id: 'session-1' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.featuredStudent).toEqual({
      studentId: undefined,
      code: undefined,
    });
  });

  it('should handle session with no students', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const emptySession: Session = {
      ...mockSession,
      students: new Map(),
      participants: [],
    };

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(emptySession),
      getStudents: jest.fn().mockResolvedValue([]),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/state');
    const params = Promise.resolve({ id: 'session-1' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.students).toEqual([]);
  });

  it('should return 500 on server error', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const mockSessionManager = {
      getSession: jest.fn().mockRejectedValue(new Error('Database error')),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/state');
    const params = Promise.resolve({ id: 'session-1' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to load session state');
  });
});
