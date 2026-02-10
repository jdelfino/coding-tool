/**
 * Tests for POST /api/sessions/[id]/practice route
 *
 * Allows students to execute code in completed sessions via ephemeral sandboxes.
 */

import { NextRequest } from 'next/server';
import { POST } from '../route';
import { getAuthenticatedUserWithToken } from '@/server/auth/api-auth';
import { Session } from '@/server/types';
import { Problem, ExecutionSettings } from '@/server/types/problem';

// Mock dependencies
jest.mock('@/server/auth/api-auth');
jest.mock('@/server/persistence');
jest.mock('@/server/code-execution/ephemeral-execute');

import { createStorage } from '@/server/persistence';
import { executeEphemeral } from '@/server/code-execution/ephemeral-execute';

const mockGetAuthenticatedUserWithToken = getAuthenticatedUserWithToken as jest.MockedFunction<typeof getAuthenticatedUserWithToken>;
const mockCreateStorage = createStorage as jest.MockedFunction<typeof createStorage>;
const mockExecuteEphemeral = executeEphemeral as jest.MockedFunction<typeof executeEphemeral>;

describe('POST /api/sessions/[id]/practice', () => {
  const mockUser = {
    id: 'user-1',
    email: 'student@example.com',
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
    executionSettings: {
      stdin: 'default stdin',
      randomSeed: 42,
    },
    authorId: 'instructor-1',
    classId: 'test-class-id',
    tags: [],
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
    participants: ['user-1'], // Include mockUser as participant
    status: 'completed', // Practice requires completed sessions
    sectionId: 'section-1',
    sectionName: 'Test Section',
  };

  let mockStorage: {
    sessions: {
      getSession: jest.Mock;
    };
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockStorage = {
      sessions: {
        getSession: jest.fn(),
      },
    };
    mockCreateStorage.mockResolvedValue(mockStorage as unknown as Awaited<ReturnType<typeof createStorage>>);
  });

  it('should return 401 when not authenticated', async () => {
    mockGetAuthenticatedUserWithToken.mockRejectedValue(new Error('Not authenticated'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/practice', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('should return 400 when code is missing', async () => {
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/practice', {
      method: 'POST',
      body: JSON.stringify({}),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Code is required');
  });

  it('should return 404 when session not found', async () => {
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/practice', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('should return 400 when session is active (must be completed)', async () => {
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue({
      ...mockSession,
      status: 'active',
    });

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/practice', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Practice mode is only available for completed sessions');
  });

  it('should return 403 when user is not a participant', async () => {
    const nonParticipantUser = {
      ...mockUser,
      id: 'other-user-id',
    };
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: nonParticipantUser, accessToken: 'test-token' });

    // Session where user is not a participant
    const restrictedSession = {
      ...mockSession,
      creatorId: 'instructor-1',
      participants: ['student-1', 'student-2'],
    };
    mockStorage.sessions.getSession.mockResolvedValue(restrictedSession);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/practice', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toBe('Access denied. You are not a participant in this session.');
  });

  it('should successfully execute code with problem settings', async () => {
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);

    const mockResult = {
      success: true,
      output: 'Hello\n',
      error: '',
      executionTime: 100,
    };

    mockExecuteEphemeral.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/practice', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockResult);
    expect(mockExecuteEphemeral).toHaveBeenCalledWith(
      {
        code: 'print("Hello")',
        executionSettings: mockProblem.executionSettings,
      },
      undefined
    );
  });

  it('should successfully execute code with payload settings override', async () => {
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);

    const payloadSettings: ExecutionSettings = {
      stdin: 'override stdin',
      randomSeed: 999,
    };

    const mockResult = {
      success: true,
      output: 'Override Output\n',
      error: '',
      executionTime: 50,
    };

    mockExecuteEphemeral.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/practice', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("Override")',
        executionSettings: payloadSettings,
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data).toEqual(mockResult);
    expect(mockExecuteEphemeral).toHaveBeenCalledWith(
      {
        code: 'print("Override")',
        executionSettings: payloadSettings,
      },
      undefined
    );
  });

  it('should return 500 on execution error', async () => {
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);

    mockExecuteEphemeral.mockRejectedValue(new Error('Execution failed'));

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/practice', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to execute code');
  });

  it('should allow session creator (instructor) to practice', async () => {
    const instructorUser = {
      ...mockUser,
      id: 'instructor-1',
      role: 'instructor' as const,
    };
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: instructorUser, accessToken: 'test-token' });
    mockStorage.sessions.getSession.mockResolvedValue(mockSession);

    const mockResult = {
      success: true,
      output: 'Hello\n',
      error: '',
      executionTime: 100,
    };

    mockExecuteEphemeral.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/practice', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    expect(mockExecuteEphemeral).toHaveBeenCalled();
  });

  it('should use empty execution settings when problem has none', async () => {
    mockGetAuthenticatedUserWithToken.mockResolvedValue({ user: mockUser, accessToken: 'test-token' });

    const sessionWithoutSettings = {
      ...mockSession,
      problem: {
        ...mockProblem,
        executionSettings: undefined,
      },
    };
    mockStorage.sessions.getSession.mockResolvedValue(sessionWithoutSettings);

    const mockResult = {
      success: true,
      output: 'Hello\n',
      error: '',
      executionTime: 100,
    };

    mockExecuteEphemeral.mockResolvedValue(mockResult);

    const request = new NextRequest('http://localhost:3000/api/sessions/session-1/practice', {
      method: 'POST',
      body: JSON.stringify({
        code: 'print("Hello")',
      }),
    });
    const params = Promise.resolve({ id: 'session-1' });

    const response = await POST(request, { params });

    expect(response.status).toBe(200);
    expect(mockExecuteEphemeral).toHaveBeenCalledWith(
      {
        code: 'print("Hello")',
        executionSettings: {},
      },
      undefined
    );
  });
});
