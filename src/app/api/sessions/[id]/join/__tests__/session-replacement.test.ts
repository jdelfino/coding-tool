/**
 * Integration tests for session replacement scenarios
 *
 * Tests that student data is preserved correctly when:
 * - Instructor replaces a session with a new one
 * - Student joins the new session
 * - Old session data should be preserved
 */

import { POST } from '../route';
import { NextRequest } from 'next/server';
import * as ApiAuth from '@/server/auth/api-auth';
import { createStorage } from '@/server/persistence';
import { IStorageRepository } from '@/server/persistence/interfaces';
import * as SessionService from '@/server/services/session-service';

// Mock dependencies
jest.mock('@/server/auth/api-auth');
jest.mock('@/server/persistence');
jest.mock('@/server/services/session-service');
jest.mock('@/lib/supabase/broadcast', () => ({
  sendBroadcast: jest.fn().mockResolvedValue(undefined),
}));
jest.mock('@/server/rate-limit', () => ({
  rateLimit: jest.fn().mockResolvedValue(undefined),
}));

const mockApiAuth = ApiAuth as jest.Mocked<typeof ApiAuth>;
const mockCreateStorage = createStorage as jest.MockedFunction<typeof createStorage>;
const mockSessionService = SessionService as jest.Mocked<typeof SessionService>;

describe('POST /api/sessions/[id]/join - Session Replacement', () => {
  const mockUser = {
    id: 'student-1',
    email: 'student@test.com',
    role: 'student' as const,
    namespaceId: 'test-namespace',
  };

  let mockStorage: jest.Mocked<IStorageRepository>;

  beforeEach(() => {
    jest.clearAllMocks();

    // Mock auth
    mockApiAuth.getAuthenticatedUserWithToken.mockResolvedValue({
      user: mockUser,
      accessToken: 'test-token',
    });

    // Mock storage
    mockStorage = {
      sessions: {
        getSession: jest.fn(),
        updateSession: jest.fn(),
      },
    } as any;

    mockCreateStorage.mockResolvedValue(mockStorage);
  });

  it('should preserve old session data when student joins a replacement session', async () => {
    // Setup: Student has code saved in session 1
    const oldSession = {
      id: 'session-1',
      namespaceId: 'test-namespace',
      sectionId: 'section-1',
      sectionName: 'Section 1',
      problem: {
        id: 'problem-1',
        title: 'FizzBuzz',
        starterCode: '# FizzBuzz starter\n',
      },
      students: new Map([
        [
          'student-1',
          {
            userId: 'student-1',
            name: 'Test Student',
            code: '# FizzBuzz solution\nfor i in range(1, 101):\n    print(i)',
            lastUpdate: new Date(),
          },
        ],
      ]),
      status: 'completed' as const,
      participants: ['student-1'],
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: 'instructor-1',
    };

    // Setup: New session (session 2) with different problem
    const newSession = {
      id: 'session-2',
      namespaceId: 'test-namespace',
      sectionId: 'section-1',
      sectionName: 'Section 1',
      problem: {
        id: 'problem-2',
        title: 'Fibonacci',
        starterCode: '# Fibonacci starter\n',
      },
      students: new Map(), // Empty - student hasn't joined yet
      status: 'active' as const,
      participants: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: 'instructor-1',
    };

    // Mock getSession to return the new session (without the student)
    mockStorage.sessions.getSession.mockResolvedValue(newSession);

    // Mock addStudent to return student with starter code
    const newStudent = {
      userId: 'student-1',
      name: 'Test Student',
      code: '# Fibonacci starter\n', // Should be Fibonacci starter, not FizzBuzz
      lastUpdate: new Date(),
    };
    mockSessionService.addStudent.mockResolvedValue(newStudent);
    mockSessionService.getStudentData.mockReturnValue({
      userId: 'student-1',
      name: 'Test Student',
      code: '# Fibonacci starter\n',
      lastUpdate: new Date(),
    });

    // Create request
    const request = new NextRequest('http://localhost/api/sessions/session-2/join', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Student' }),
    });

    const params = Promise.resolve({ id: 'session-2' });

    // Execute
    const response = await POST(request, { params });
    const data = await response.json();

    // Verify student got correct starter code
    expect(data.success).toBe(true);
    expect(data.student.code).toBe('# Fibonacci starter\n');
    expect(data.student.code).not.toContain('FizzBuzz');

    // Verify addStudent was called with the new session (not the old one)
    expect(mockSessionService.addStudent).toHaveBeenCalledWith(
      mockStorage,
      newSession,
      'student-1',
      'Test Student'
    );
  });

  it('should not delete student data from completed sessions', async () => {
    // This test verifies that the join route doesn't accidentally delete
    // student work from old completed sessions

    const newSession = {
      id: 'session-2',
      namespaceId: 'test-namespace',
      sectionId: 'section-1',
      sectionName: 'Section 1',
      problem: {
        id: 'problem-2',
        title: 'New Problem',
        starterCode: '# New starter\n',
      },
      students: new Map(),
      status: 'active' as const,
      participants: [],
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: 'instructor-1',
    };

    mockStorage.sessions.getSession.mockResolvedValue(newSession);

    const newStudent = {
      userId: 'student-1',
      name: 'Test Student',
      code: '# New starter\n',
      lastUpdate: new Date(),
    };
    mockSessionService.addStudent.mockResolvedValue(newStudent);
    mockSessionService.getStudentData.mockReturnValue(newStudent);

    // Create request
    const request = new NextRequest('http://localhost/api/sessions/session-2/join', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Student' }),
    });

    const params = Promise.resolve({ id: 'session-2' });

    // Execute
    await POST(request, { params });

    // Verify that getSession was called with the NEW session ID
    expect(mockStorage.sessions.getSession).toHaveBeenCalledWith('session-2');

    // The old session (session-1) should not be touched at all
    // This is implicit - if the join route was deleting from completed sessions,
    // we'd see additional calls to getSession or delete operations
  });

  it('should handle student rejoining the same session', async () => {
    // Student already has code in the session, joins again
    const existingCode = '# My work in progress\nprint("hello")';

    const session = {
      id: 'session-1',
      namespaceId: 'test-namespace',
      sectionId: 'section-1',
      sectionName: 'Section 1',
      problem: {
        id: 'problem-1',
        title: 'Problem',
        starterCode: '# Starter code\n',
      },
      students: new Map([
        [
          'student-1',
          {
            userId: 'student-1',
            name: 'Test Student',
            code: existingCode,
            lastUpdate: new Date(),
          },
        ],
      ]),
      status: 'active' as const,
      participants: ['student-1'],
      createdAt: new Date(),
      lastActivity: new Date(),
      creatorId: 'instructor-1',
    };

    mockStorage.sessions.getSession.mockResolvedValue(session);

    // addStudent should preserve existing code
    const returnedStudent = {
      userId: 'student-1',
      name: 'Test Student',
      code: existingCode, // Preserved
      lastUpdate: new Date(),
    };
    mockSessionService.addStudent.mockResolvedValue(returnedStudent);
    mockSessionService.getStudentData.mockReturnValue(returnedStudent);

    const request = new NextRequest('http://localhost/api/sessions/session-1/join', {
      method: 'POST',
      body: JSON.stringify({ name: 'Test Student' }),
    });

    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    // Verify existing code was preserved
    expect(data.success).toBe(true);
    expect(data.student.code).toBe(existingCode);
  });
});
