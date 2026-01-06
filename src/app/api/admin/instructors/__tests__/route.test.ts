/**
 * Unit tests for POST /api/admin/instructors
 * Tests instructor creation endpoint with proper role-based access control
 */

import { POST } from '../route';
import { getAuthProvider } from '@/server/auth';
import { NextRequest } from 'next/server';
import * as apiHelpers from '@/server/auth/api-helpers';

// Mock dependencies
jest.mock('@/server/auth');
jest.mock('@/server/auth/api-helpers', () => ({
  requirePermission: jest.fn(),
  getNamespaceContext: jest.fn((req: any, user: any) => user.namespaceId || 'default'),
}));

const mockGetAuthProvider = getAuthProvider as jest.MockedFunction<typeof getAuthProvider>;
const mockRequirePermission = apiHelpers.requirePermission as jest.MockedFunction<typeof apiHelpers.requirePermission>;

describe('POST /api/admin/instructors', () => {
  let mockAuthProvider: any;
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();

    // Setup mock auth provider
    mockAuthProvider = {
      getSession: jest.fn(),
      signUp: jest.fn(),
    };
    mockGetAuthProvider.mockResolvedValue(mockAuthProvider);
  });

  /**
   * Helper to set up requirePermission mock to simulate auth+permission check
   */
  const mockRequirePermissionForUser = (user: any | null, permission: string = 'user.create') => {
    if (!user) {
      // Not authenticated
      mockRequirePermission.mockResolvedValue(
        new (require('next/server').NextResponse)(
          JSON.stringify({ error: 'Not authenticated' }),
          { status: 401 }
        )
      );
    } else {
      // Check if user has permission (mock RBAC logic)
      const hasPermission =
        (permission === 'user.create' && (user.role === 'instructor' || user.role === 'namespace-admin')) ||
        (user.role === 'namespace-admin'); // Namespace admins have all permissions

      if (hasPermission) {
        // Auth successful, return auth context
        mockRequirePermission.mockResolvedValue({
          user,
          rbac: {
            hasPermission: jest.fn().mockReturnValue(true),
            canManageUser: jest.fn().mockReturnValue(true),
            canAccessSession: jest.fn().mockResolvedValue(true),
            getRolePermissions: jest.fn().mockReturnValue([]),
            assertPermission: jest.fn(),
            assertCanAccessSession: jest.fn().mockResolvedValue(undefined),
            assertCanManageUser: jest.fn(),
          },
        });
      } else {
        // Permission denied
        mockRequirePermission.mockResolvedValue(
          new (require('next/server').NextResponse)(
            JSON.stringify({ error: `Forbidden: Requires ${permission} permission` }),
            { status: 403 }
          )
        );
      }
    }
  };

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
      mockRequirePermissionForUser(null);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 401 when session is invalid', async () => {
      mockRequest = createMockRequest({ username: 'newteacher' }, 'invalid-session');
      mockRequirePermissionForUser(null);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });
  });

  describe('Authorization', () => {
    it('should allow instructors to create instructor accounts', async () => {
      const instructor = { id: 'instructor1', username: 'instructor', role: 'instructor' };
      mockRequest = createMockRequest({ email: 'newteacher@example.com', username: 'newteacher', password: 'password123' }, 'instructor-session');
      mockRequirePermissionForUser(instructor);

      mockAuthProvider.signUp.mockResolvedValue({
        id: 'new-id',
        email: 'newteacher@example.com',
        username: 'newteacher',
        role: 'instructor',
        namespaceId: 'default',
        createdAt: new Date(),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.username).toBe('newteacher');
      expect(data.user.role).toBe('instructor');
      expect(mockAuthProvider.signUp).toHaveBeenCalledWith('newteacher@example.com', 'password123', 'newteacher', 'instructor', 'default');
    });

    it('should allow admins to create instructor accounts', async () => {
      const admin = { id: 'admin1', username: 'admin', role: 'namespace-admin' };
      mockRequest = createMockRequest({ email: 'newteacher@example.com', username: 'newteacher', password: 'password123' }, 'admin-session');
      mockRequirePermissionForUser(admin);

      mockAuthProvider.signUp.mockResolvedValue({
        id: 'new-id',
        email: 'newteacher@example.com',
        username: 'newteacher',
        role: 'instructor',
        namespaceId: 'default',
        createdAt: new Date(),
      });

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.user.username).toBe('newteacher');
      expect(data.user.role).toBe('instructor');
    });

    it('should deny students from creating instructor accounts', async () => {
      const student = { id: 'student1', username: 'student', role: 'student' };
      mockRequest = createMockRequest({ email: 'newteacher@example.com', password: 'password123', username: 'newteacher' }, 'student-session');
      mockRequirePermissionForUser(student);

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Forbidden');
      expect(mockAuthProvider.signUp).not.toHaveBeenCalled();
    });
  });

  describe('Input Validation', () => {
    const instructor = { id: 'instructor1', username: 'instructor', role: 'instructor' };

    beforeEach(() => {
      mockRequirePermissionForUser(instructor);
    });

    it('should return 400 when username is missing', async () => {
      mockRequest = createMockRequest({ email: 'test@example.com', password: 'password123' }, 'instructor-session');

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Username is required');
      expect(mockAuthProvider.signUp).not.toHaveBeenCalled();
    });

    it('should return 400 when username is not a string', async () => {
      mockRequest = createMockRequest({ email: 'test@example.com', password: 'password123', username: 123 }, 'instructor-session');

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Username is required');
      expect(mockAuthProvider.signUp).not.toHaveBeenCalled();
    });

    it('should trim whitespace from username', async () => {
      mockRequest = createMockRequest({ email: 'teacher@example.com', password: 'password123', username: '  teacher  ' }, 'instructor-session');
      mockAuthProvider.signUp.mockResolvedValue({
        id: 'new-id',
        username: 'teacher',
        email: 'teacher@example.com',
        role: 'instructor',
        createdAt: new Date().toISOString(),
      });

      await POST(mockRequest);

      expect(mockAuthProvider.signUp).toHaveBeenCalledWith('teacher@example.com', 'password123', 'teacher', 'instructor', 'default');
    });
  });

  describe('Error Handling', () => {
    const instructor = { id: 'instructor1', username: 'instructor', role: 'instructor' };

    beforeEach(() => {
      mockRequirePermissionForUser(instructor);
    });

    it('should return 409 when username is already taken', async () => {
      mockRequest = createMockRequest({ email: 'existing@example.com', password: 'password123', username: 'existinguser' }, 'instructor-session');
      mockAuthProvider.signUp.mockRejectedValue(
        new Error('Username already taken')
      );

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('already taken');
    });

    it('should return 500 for other errors', async () => {
      mockRequest = createMockRequest({ email: 'newteacher@example.com', password: 'password123', username: 'newteacher' }, 'instructor-session');
      mockAuthProvider.signUp.mockRejectedValue(new Error('Database error'));

      const response = await POST(mockRequest);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create instructor');
    });
  });
});
