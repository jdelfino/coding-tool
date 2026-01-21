/**
 * Tests for GET /api/sessions/[id]/state route
 *
 * These are unit tests for the HTTP layer - they mock storage
 * to test route behavior (auth, validation, response formatting).
 */

import { NextRequest } from 'next/server';
import { GET } from '../route';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import { Session, Student } from '@/server/types';
import { Problem } from '@/server/types/problem';

jest.mock('@/server/auth/api-auth');
jest.mock('@/server/persistence');

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;

describe('GET /api/sessions/[id]/state', () => {
  const mockUser = {
    id: 'user-1',
    email: 'instructor@example.com',
    role: 'instructor' as const,
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
    authorId: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStudent1: Student = {
    id: 'student-1',
    name: 'Alice',
    code: 'print("Alice")',
    lastUpdate: new Date(),
  };

  const mockStudent2: Student = {
    id: 'student-2',
    name: 'Bob',
    code: 'print("Bob")',
    lastUpdate: new Date(),
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

  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockStorage = {
      sessions: {
        getSession: jest.fn().mockResolvedValue(mockSession),
      },
    };

    mockGetStorage.mockResolvedValue(mockStorage);
  });

  it('returns session state for authenticated user', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

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

  it('returns 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/state');
    const params = Promise.resolve({ id: 'session-1' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('returns 404 when session not found', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/state');
    const params = Promise.resolve({ id: 'session-1' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('handles session with no featured student', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue({
      ...mockSession,
      featuredStudentId: undefined,
      featuredCode: undefined,
    });

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

  it('handles session with no students', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue({
      ...mockSession,
      students: new Map(),
      participants: [],
    });

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/state');
    const params = Promise.resolve({ id: 'session-1' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.students).toEqual([]);
  });

  it('returns 500 on server error', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/state');
    const params = Promise.resolve({ id: 'session-1' });

    const response = await GET(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to load session state');
  });
});
