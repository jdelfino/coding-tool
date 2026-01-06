/**
 * Tests for POST /api/sessions/[id]/feature route
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthenticatedUser, checkPermission } from '@/server/auth/api-auth';
import { getSessionManager } from '@/server/session-manager';
import { Session, Student } from '@/server/types';
import { Problem } from '@/server/types/problem';

// Mock dependencies
jest.mock('@/server/auth/api-auth');
jest.mock('@/server/session-manager');

const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockCheckPermission = checkPermission as jest.MockedFunction<typeof checkPermission>;
const mockGetSessionManager = getSessionManager as jest.MockedFunction<typeof getSessionManager>;

describe('POST /api/sessions/[id]/feature', () => {
  const mockInstructor = {
    id: 'instructor-1',
    email: 'instructor@example.com',
    username: 'instructor',
    role: 'instructor' as const,
    namespaceId: 'default',
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  const mockStudent = {
    id: 'student-1',
    email: 'student@example.com',
    username: 'student',
    role: 'student' as const,
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
    authorId: 'instructor-1',
    classId: undefined,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStudentObj: Student = {
    id: 'student-1',
    name: 'Alice',
    code: 'print("Alice code")',
    lastUpdate: new Date(),
    executionSettings: undefined,
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

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should successfully feature a student', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(true);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      setFeaturedSubmission: jest.fn().mockResolvedValue(true),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.featuredStudentId).toBe('student-1');
    expect(data.featuredCode).toBe('print("Alice code")');
    expect(mockSessionManager.setFeaturedSubmission).toHaveBeenCalledWith('session-1', 'student-1');
  });

  it('should clear featured student when studentId is not provided', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(true);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      clearFeaturedSubmission: jest.fn().mockResolvedValue(true),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.featuredStudentId).toBeUndefined();
    expect(mockSessionManager.clearFeaturedSubmission).toHaveBeenCalledWith('session-1');
  });

  it('should return 401 when not authenticated', async () => {
    mockGetAuthenticatedUser.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Not authenticated');
  });

  it('should return 403 when user lacks permission', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockStudent);
    mockCheckPermission.mockReturnValue(false); // Student lacks permission

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('You do not have permission to feature students');
    expect(mockCheckPermission).toHaveBeenCalledWith(mockStudent, 'session.viewAll');
  });

  it('should return 404 when session not found', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(true);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(null),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('should return 404 when student not found in session', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(true);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      setFeaturedSubmission: jest.fn().mockResolvedValue(true),
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'nonexistent-student',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Student not found in session');
  });

  it('should return 500 when setFeaturedSubmission fails', async () => {
    mockGetAuthenticatedUser.mockResolvedValue(mockInstructor);
    mockCheckPermission.mockReturnValue(true);

    const mockSessionManager = {
      getSession: jest.fn().mockResolvedValue(mockSession),
      setFeaturedSubmission: jest.fn().mockResolvedValue(false), // Failure
    };

    mockGetSessionManager.mockReturnValue(mockSessionManager as any);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/feature', {
      method: 'POST',
      body: JSON.stringify({
        studentId: 'student-1',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to set featured student');
  });
});
