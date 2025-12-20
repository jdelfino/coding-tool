/**
 * Unit tests for POST /api/admin/instructors
 * Tests instructor creation endpoint with proper role-based access control
 */

import { POST } from '../route';
import { getAuthProvider } from '@/server/auth';
import { NextRequest } from 'next/server';

// Mock dependencies
jest.mock('@/server/auth');

const mockGetAuthProvider = getAuthProvider as jest.MockedFunction<typeof getAuthProvider>;

describe('POST /api/admin/instructors', () => {
  let mockAuthProvider: any;
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock auth provider
    mockAuthProvider = {
      getSession: jest.fn(),
      createUser: jest.fn(),
    };
    mockGetAuthProvider.mockResolvedValue(mockAuthProvider);
  });

  const createMockRequest = (body: any, sessionId?: string): NextRequest => {
    const url = 'http://localhost:3000/api/admin/instructors';
    const request = new NextRequest(url, {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Mock cookies
    if (sessionId) {
      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn((name: string) => 
            name === 'sessionId' ? { value: sessionId } : undefined
          ),
        },
        configurable: true,
      });
    } else {
      Object.defineProperty(request, 'cookies', {
        value: {
          get: jest.fn(() => undefined),
        },
        configurable: true,
      });
    }

    return request;
  };

  describe('Authentication', () => {
    it('should return 401 when no session cookie is provided', async () => {
      mockRequest = createMockRequest({ username: 'newteacher' });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 401 when session is invalid', async () => {
      mockRequest = createMockRequest({ username: 'newteacher' }, 'invalid-session');
      mockAuthProvider.getSession.mockResolvedValue(null);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Invalid session');
    });
  });

  describe('Authorization', () => {
    it('should allow instructors to create instructor accounts', async () => {
      mockRequest = createMockRequest({ username: 'newteacher' }, 'instructor-session');
      mockAuthProvider.getSession.mockResolvedValue({
        user: { id: 'instructor1', username: 'instructor', role: 'instructor' },
      });
      mockAuthProvider.createUser.mockResolvedValue({
        id: 'new-id',
        username: 'newteacher',
        role: 'instructor',
        createdAt: new Date().toISOString(),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.username).toBe('newteacher');
      expect(data.user.role).toBe('instructor');
      expect(mockAuthProvider.createUser).toHaveBeenCalledWith('newteacher', 'instructor');
    });

    it('should allow admins to create instructor accounts', async () => {
      mockRequest = createMockRequest({ username: 'newteacher' }, 'admin-session');
      mockAuthProvider.getSession.mockResolvedValue({
        user: { id: 'admin1', username: 'admin', role: 'admin' },
      });
      mockAuthProvider.createUser.mockResolvedValue({
        id: 'new-id',
        username: 'newteacher',
        role: 'instructor',
        createdAt: new Date().toISOString(),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.username).toBe('newteacher');
      expect(data.user.role).toBe('instructor');
    });

    it('should deny students from creating instructor accounts', async () => {
      mockRequest = createMockRequest({ username: 'newteacher' }, 'student-session');
      mockAuthProvider.getSession.mockResolvedValue({
        user: { id: 'student1', username: 'student', role: 'student' },
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Forbidden: Instructors only');
      expect(mockAuthProvider.createUser).not.toHaveBeenCalled();
    });
  });

  describe('Input Validation', () => {
    beforeEach(() => {
      mockAuthProvider.getSession.mockResolvedValue({
        user: { id: 'instructor1', username: 'instructor', role: 'instructor' },
      });
    });

    it('should return 400 when username is missing', async () => {
      mockRequest = createMockRequest({}, 'instructor-session');

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Username is required');
      expect(mockAuthProvider.createUser).not.toHaveBeenCalled();
    });

    it('should return 400 when username is not a string', async () => {
      mockRequest = createMockRequest({ username: 123 }, 'instructor-session');

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Username is required');
      expect(mockAuthProvider.createUser).not.toHaveBeenCalled();
    });

    it('should trim whitespace from username', async () => {
      mockRequest = createMockRequest({ username: '  teacher  ' }, 'instructor-session');
      mockAuthProvider.createUser.mockResolvedValue({
        id: 'new-id',
        username: 'teacher',
        role: 'instructor',
        createdAt: new Date().toISOString(),
      });

      await POST(mockRequest);

      expect(mockAuthProvider.createUser).toHaveBeenCalledWith('teacher', 'instructor');
    });
  });

  describe('Error Handling', () => {
    beforeEach(() => {
      mockAuthProvider.getSession.mockResolvedValue({
        user: { id: 'instructor1', username: 'instructor', role: 'instructor' },
      });
    });

    it('should return 409 when username is already taken', async () => {
      mockRequest = createMockRequest({ username: 'existinguser' }, 'instructor-session');
      mockAuthProvider.createUser.mockRejectedValue(
        new Error('Username already taken')
      );

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already taken');
    });

    it('should return 500 for other errors', async () => {
      mockRequest = createMockRequest({ username: 'newteacher' }, 'instructor-session');
      mockAuthProvider.createUser.mockRejectedValue(new Error('Database error'));

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create instructor');
    });
  });
});
