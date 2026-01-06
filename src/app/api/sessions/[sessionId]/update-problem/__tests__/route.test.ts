import { NextRequest, NextResponse } from 'next/server';
import { POST } from '../route';
import { getAuthProvider } from '@/server/auth';
import { getSessionManager } from '@/server/session-manager';
import type { User } from '@/server/auth/types';

// Mock dependencies
jest.mock('@/server/auth');
jest.mock('@/server/session-manager');

describe('POST /api/sessions/[sessionId]/update-problem', () => {
  const mockUser: User = {
    id: 'instructor-1',
    username: 'instructor',
    email: 'instructor@example.com',
    role: 'instructor' as const,
    namespaceId: 'default',
    createdAt: new Date('2024-01-01'),
  };

  const mockProblem = {
    title: 'Updated Problem',
    description: 'Updated description',
    starterCode: 'print("Updated")',
  };

  const mockExecutionSettings = {
    stdin: 'test input\n',
    randomSeed: 42,
  };

  const mockSession = {
    id: 'session-1',
    joinCode: 'ABC123',
    sectionId: 'section-1',
    sectionName: 'Section A',
    creatorId: 'instructor-1',
    participants: ['instructor-1'],
    status: 'active' as const,
    problem: mockProblem,
  };

  let mockAuthProvider: any;
  let mockSessionManager: any;

  beforeEach(() => {
    jest.clearAllMocks();

    mockAuthProvider = {
      getSession: jest.fn(),
    };

    mockSessionManager = {
      getSession: jest.fn(),
      updateSessionProblem: jest.fn(),
    };

    (getAuthProvider as jest.Mock).mockResolvedValue(mockAuthProvider);
    (getSessionManager as jest.Mock).mockResolvedValue(mockSessionManager);
  });

  it('updates problem with execution settings', async () => {
    mockAuthProvider.getSession.mockResolvedValue({
      user: mockUser,
    });
    mockSessionManager.getSession.mockResolvedValue(mockSession);
    mockSessionManager.updateSessionProblem.mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/sessions/session-1/update-problem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({
        problem: mockProblem,
        executionSettings: mockExecutionSettings,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ sessionId: 'session-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('Updated Problem');
    expect(mockSessionManager.updateSessionProblem).toHaveBeenCalledWith(
      'session-1',
      mockProblem,
      mockExecutionSettings
    );
  });

  it('updates problem without execution settings', async () => {
    mockAuthProvider.getSession.mockResolvedValue({
      user: mockUser,
    });
    mockSessionManager.getSession.mockResolvedValue(mockSession);
    mockSessionManager.updateSessionProblem.mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/sessions/session-1/update-problem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({
        problem: mockProblem,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ sessionId: 'session-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(mockSessionManager.updateSessionProblem).toHaveBeenCalledWith(
      'session-1',
      mockProblem,
      undefined
    );
  });

  it('returns 401 when not authenticated', async () => {
    mockAuthProvider.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sessions/session-1/update-problem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        problem: mockProblem,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ sessionId: 'session-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe('Unauthorized');
  });

  it('returns 403 when user is not an instructor', async () => {
    const studentUser: User = { ...mockUser, role: 'student' };
    mockAuthProvider.getSession.mockResolvedValue({
      user: studentUser,
    });
    mockSessionManager.getSession.mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost/api/sessions/session-1/update-problem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({
        problem: mockProblem,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ sessionId: 'session-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.error).toContain('Only instructors');
  });

  it('returns 400 when problem is missing', async () => {
    mockAuthProvider.getSession.mockResolvedValue({
      user: mockUser,
    });
    mockSessionManager.getSession.mockResolvedValue(mockSession);

    const request = new NextRequest('http://localhost/api/sessions/session-1/update-problem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({}),
    });

    const response = await POST(request, {
      params: Promise.resolve({ sessionId: 'session-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toBe('Invalid problem object');
  });

  it('returns 404 when session not found', async () => {
    mockAuthProvider.getSession.mockResolvedValue({
      user: mockUser,
    });
    mockSessionManager.getSession.mockResolvedValue(null);

    const request = new NextRequest('http://localhost/api/sessions/session-1/update-problem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({
        problem: mockProblem,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ sessionId: 'session-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(404);
    expect(data.error).toBe('Session not found');
  });

  it('returns 500 when update fails', async () => {
    mockAuthProvider.getSession.mockResolvedValue({
      user: mockUser,
    });
    mockSessionManager.getSession.mockResolvedValue(mockSession);
    mockSessionManager.updateSessionProblem.mockResolvedValue(false);

    const request = new NextRequest('http://localhost/api/sessions/session-1/update-problem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({
        problem: mockProblem,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ sessionId: 'session-1' }),
    });
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Failed to update problem in session');
  });

  it('allows namespace-admin to update problem', async () => {
    const adminUser: User = { ...mockUser, role: 'namespace-admin' };
    mockAuthProvider.getSession.mockResolvedValue({
      user: adminUser,
    });
    mockSessionManager.getSession.mockResolvedValue(mockSession);
    mockSessionManager.updateSessionProblem.mockResolvedValue(true);

    const request = new NextRequest('http://localhost/api/sessions/session-1/update-problem', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Cookie: 'sessionId=test-session-id',
      },
      body: JSON.stringify({
        problem: mockProblem,
      }),
    });

    const response = await POST(request, {
      params: Promise.resolve({ sessionId: 'session-1' }),
    });

    expect(response.status).toBe(200);
  });
});
