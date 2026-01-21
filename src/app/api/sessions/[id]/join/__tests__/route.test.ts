/**
 * Tests for POST /api/sessions/[id]/join route
 *
 * These are unit tests for the HTTP layer - they mock session-service
 * to test route behavior (auth, validation, error handling).
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';
import { Session } from '@/server/types';
import { Problem } from '@/server/types/problem';

jest.mock('@/server/auth/api-auth');
jest.mock('@/server/persistence');
jest.mock('@/server/services/session-service');

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;

describe('POST /api/sessions/[id]/join', () => {
  const mockUser = {
    id: 'user-1',
    email: 'student@example.com',
    role: 'student' as const,
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

  const mockSession: Session = {
    id: 'session-1',
    namespaceId: 'default',
    problem: mockProblem,
    students: new Map(),
    createdAt: new Date(),
    lastActivity: new Date(),
    creatorId: 'instructor-1',
    participants: [],
    status: 'active',
    sectionId: 'section-1',
    sectionName: 'Test Section',
  };

  const mockStudent = {
    id: 'user-1',
    name: 'Alice',
    code: 'print("Hello")',
    lastUpdate: new Date(),
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

    // Default service mocks
    (SessionService.addStudent as jest.Mock).mockResolvedValue(mockStudent);
    (SessionService.getStudentData as jest.Mock).mockReturnValue({
      code: mockStudent.code,
      executionSettings: undefined,
    });
  });

  it('joins session successfully', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'user-1', name: 'Alice' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.student.id).toBe('user-1');
    expect(data.student.name).toBe('Alice');
    expect(SessionService.addStudent).toHaveBeenCalledWith(
      mockStorage, mockSession, 'user-1', 'Alice'
    );
  });

  it('uses authenticated user ID when studentId not provided', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    expect(SessionService.addStudent).toHaveBeenCalledWith(
      mockStorage, mockSession, 'user-1', 'Alice'
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });

    expect(response.status).toBe(401);
  });

  it('returns 400 when name is missing', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'user-1' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Student name is required');
  });

  it('returns 400 when name is too long', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({ name: 'A'.repeat(51) }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Student name is too long (max 50 characters)');
  });

  it('returns 404 when session not found', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('returns 400 when session is completed', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    mockStorage.sessions.getSession.mockResolvedValue({
      ...mockSession,
      status: 'completed',
    });

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('This session has ended and cannot be joined');
  });

  it('returns 500 when service fails', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockUser);
    (SessionService.addStudent as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({ name: 'Alice' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to join session');
  });
});
