/**
 * Tests for POST /api/sessions/[id]/feature route
 *
 * These are unit tests for the HTTP layer - they mock session-service
 * to test route behavior (auth, validation, error handling).
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthenticatedUser, checkPermission } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';
import { Session, Student } from '@/server/types';
import { Problem } from '@/server/types/problem';

jest.mock('@/server/auth/api-auth');
jest.mock('@/server/persistence');
jest.mock('@/server/services/session-service');

// Mock Supabase client for broadcast functionality
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    channel: jest.fn(() => ({
      subscribe: jest.fn(),
      send: jest.fn(),
    })),
    removeChannel: jest.fn(),
  })),
}));

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockCheckPermission = checkPermission as jest.MockedFunction<typeof checkPermission>;
const mockGetStorage = getStorage as jest.MockedFunction<typeof getStorage>;

describe('POST /api/sessions/[id]/feature', () => {
  const mockInstructor = {
    id: 'instructor-1',
    email: 'instructor@example.com',
    username: 'instructor',
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
    authorId: 'instructor-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStudentObj: Student = {
    id: 'student-1',
    name: 'Alice',
    code: 'print("Alice code")',
    lastUpdate: new Date(),
  };

  const mockSession: Session = {
    id: 'session-1',
    namespaceId: 'default',
    problem: mockProblem,
    students: new Map([['student-1', mockStudentObj]]),
    createdAt: new Date(),
    lastActivity: new Date(),
    creatorId: 'instructor-1',
    participants: ['student-1'],
    status: 'active',
    sectionId: 'section-1',
    sectionName: 'Test Section',
  };

  let mockStorage: any;

  beforeEach(() => {
    jest.clearAllMocks();

    // Set required env vars for broadcast
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SECRET_KEY = 'test-secret-key';

    mockStorage = {
      sessions: {
        getSession: jest.fn().mockResolvedValue(mockSession),
      },
    };

    mockGetStorage.mockResolvedValue(mockStorage);

    // Default service mocks
    (SessionService.setFeaturedSubmission as jest.Mock).mockResolvedValue(undefined);
    (SessionService.clearFeaturedSubmission as jest.Mock).mockResolvedValue(undefined);
  });

  it('features a student successfully', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'student-1' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.featuredStudentId).toBe('student-1');
    expect(data.featuredCode).toBe('print("Alice code")');
    expect(SessionService.setFeaturedSubmission).toHaveBeenCalledWith(
      mockStorage, mockSession, 'student-1'
    );
  });

  it('clears featured student when studentId not provided', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(SessionService.clearFeaturedSubmission).toHaveBeenCalledWith(
      mockStorage, 'session-1'
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'student-1' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });

    expect(response.status).toBe(401);
  });

  it('returns 403 when user lacks permission', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(false);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'student-1' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You do not have permission to feature students');
  });

  it('returns 404 when session not found', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(true);
    mockStorage.sessions.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'student-1' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('returns 404 when student not found in session', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(true);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'nonexistent-student' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Student not found in session');
  });

  it('returns 500 when service fails', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(true);
    (SessionService.setFeaturedSubmission as jest.Mock).mockRejectedValue(new Error('Database error'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({ studentId: 'student-1' }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to feature student');
  });
});
