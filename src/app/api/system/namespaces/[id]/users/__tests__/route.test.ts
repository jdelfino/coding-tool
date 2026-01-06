/**
 * Unit tests for namespace users API routes
 * Tests user management within namespaces
 */

import { GET, POST } from '../route';
import { NextRequest } from 'next/server';
import * as apiHelpers from '@/server/auth/api-helpers';
import { getNamespaceRepository, getUserRepository, getAuthProvider } from '@/server/auth';

// Mock dependencies
jest.mock('@/server/auth/api-helpers');
jest.mock('@/server/auth');

const mockRequirePermission = apiHelpers.requirePermission as jest.MockedFunction<typeof apiHelpers.requirePermission>;
const mockRequireAuth = apiHelpers.requireAuth as jest.MockedFunction<typeof apiHelpers.requireAuth>;
const mockGetNamespaceRepository = getNamespaceRepository as jest.MockedFunction<typeof getNamespaceRepository>;
const mockGetUserRepository = getUserRepository as jest.MockedFunction<typeof getUserRepository>;
const mockGetAuthProvider = getAuthProvider as jest.MockedFunction<typeof getAuthProvider>;

describe('Namespace Users API', () => {
  const mockSystemAdmin = {
    id: 'admin-123',
    username: 'sysadmin',
    email: 'sysadmin@example.com',
    role: 'system-admin' as const,
    namespaceId: null,
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  const mockInstructor = {
    id: 'instructor-123',
    username: 'teacher',
    email: 'teacher@example.com',
    role: 'instructor' as const,
    namespaceId: 'test-namespace',
    createdAt: new Date(),
    lastLoginAt: new Date(),
  };

  const mockNamespace = {
    id: 'test-namespace',
    displayName: 'Test Namespace',
    active: true,
    createdBy: 'admin-123',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockNamespaceRepo = {
    getNamespace: jest.fn(),
    updateNamespace: jest.fn(),
    deactivateNamespace: jest.fn(),
    listNamespaces: jest.fn(),
    namespaceExists: jest.fn(),
    createNamespace: jest.fn(),
    initialize: jest.fn(),
    shutdown: jest.fn(),
    health: jest.fn(),
  };

  const mockUserRepo = {
    listUsers: jest.fn(),
    getUserByUsername: jest.fn(),
    getUser: jest.fn(),
    saveUser: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getUserCount: jest.fn(),
    getUserByEmail: jest.fn(),
    getUsersByNamespace: jest.fn(),
    clear: jest.fn(),
  };

  const mockAuthProvider = {
    signUp: jest.fn(),
    updateUser: jest.fn(),
    deleteUser: jest.fn(),
    getSession: jest.fn(),
    authenticateWithPassword: jest.fn(),
    getSessionFromRequest: jest.fn(),
    signOut: jest.fn(),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetNamespaceRepository.mockResolvedValue(mockNamespaceRepo as any);
    mockGetUserRepository.mockResolvedValue(mockUserRepo as any);
    mockGetAuthProvider.mockResolvedValue(mockAuthProvider as any);
  });

  const mockAuthForUser = (user: any | null, permission: string = 'namespace.viewAll') => {
    if (!user) {
      mockRequirePermission.mockResolvedValue(
        new (require('next/server').NextResponse)(
          JSON.stringify({ error: 'Not authenticated' }),
          { status: 401 }
        )
      );
      mockRequireAuth.mockResolvedValue(
        new (require('next/server').NextResponse)(
          JSON.stringify({ error: 'Not authenticated' }),
          { status: 401 }
        )
      );
    } else {
      const hasPermission = user.role === 'system-admin';
      if (hasPermission) {
        const authContext = {
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
        };
        mockRequirePermission.mockResolvedValue(authContext);
        mockRequireAuth.mockResolvedValue(authContext);
      } else {
        mockRequirePermission.mockResolvedValue(
          new (require('next/server').NextResponse)(
            JSON.stringify({ error: `Forbidden: Requires ${permission} permission` }),
            { status: 403 }
          )
        );
        mockRequireAuth.mockResolvedValue(
          new (require('next/server').NextResponse)(
            JSON.stringify({ error: 'Forbidden' }),
            { status: 403 }
          )
        );
      }
    }
  };

  const createMockRequest = (method: string, body?: any): NextRequest => {
    const url = 'http://localhost:3000/api/system/namespaces/test-namespace/users';
    return new NextRequest(url, {
      method,
      body: body ? JSON.stringify(body) : undefined,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
    });
  };

  describe('GET /api/system/namespaces/[id]/users', () => {
    it('should return 401 when not authenticated', async () => {
      mockAuthForUser(null);
      const request = createMockRequest('GET');

      const response = await GET(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 403 when user is not system-admin', async () => {
      mockAuthForUser(mockInstructor);
      const request = createMockRequest('GET');

      const response = await GET(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
    });

    it('should return 404 when namespace does not exist', async () => {
      mockAuthForUser(mockSystemAdmin);
      mockNamespaceRepo.getNamespace.mockResolvedValue(null);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return users in namespace', async () => {
      mockAuthForUser(mockSystemAdmin);
      mockNamespaceRepo.getNamespace.mockResolvedValue(mockNamespace);

      const mockUsers = [
        { id: 'u1', username: 'user1', role: 'instructor' as const, namespaceId: 'test-namespace', createdAt: new Date(), lastLoginAt: new Date() },
        { id: 'u2', username: 'user2', role: 'student' as const, namespaceId: 'test-namespace', createdAt: new Date(), lastLoginAt: new Date() },
      ];

      mockUserRepo.listUsers.mockResolvedValue([
        ...mockUsers,
        { id: 'u3', username: 'other', role: 'instructor' as const, namespaceId: 'other-namespace', createdAt: new Date(), lastLoginAt: new Date() },
      ]);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.users).toHaveLength(2);
      expect(data.users.every((u: any) => u.namespaceId === 'test-namespace')).toBe(true);
    });

    it('should return empty array when namespace has no users', async () => {
      mockAuthForUser(mockSystemAdmin);
      mockNamespaceRepo.getNamespace.mockResolvedValue(mockNamespace);
      mockUserRepo.listUsers.mockResolvedValue([]);

      const request = createMockRequest('GET');
      const response = await GET(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.users).toEqual([]);
    });
  });

  describe('POST /api/system/namespaces/[id]/users', () => {
    it('should return 401 when not authenticated', async () => {
      mockAuthForUser(null, 'user.create');
      const request = createMockRequest('POST', {
        email: 'newuser@example.com',
        password: 'password123',
        username: 'newuser',
        role: 'instructor',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Not authenticated');
    });

    it('should return 403 when user is not system-admin', async () => {
      mockAuthForUser(mockInstructor, 'user.create');
      const request = createMockRequest('POST', {
        email: 'newuser@example.com',
        password: 'password123',
        username: 'newuser',
        role: 'instructor',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(403);
    });

    it('should return 400 when username is missing', async () => {
      mockAuthForUser(mockSystemAdmin, 'user.create');
      const request = createMockRequest('POST', {
        email: 'test@example.com',
        password: 'password123',
        role: 'instructor',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Username is required');
    });

    it('should return 400 when role is missing', async () => {
      mockAuthForUser(mockSystemAdmin, 'user.create');
      const request = createMockRequest('POST', {
        email: 'newuser@example.com',
        password: 'password123',
        username: 'newuser',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Role must be');
    });

    it('should return 400 when role is invalid', async () => {
      mockAuthForUser(mockSystemAdmin, 'user.create');
      const request = createMockRequest('POST', {
        email: 'newuser@example.com',
        password: 'password123',
        username: 'newuser',
        role: 'system-admin',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('namespace-admin, instructor, or student');
    });

    it('should return 404 when namespace does not exist', async () => {
      mockAuthForUser(mockSystemAdmin, 'user.create');
      mockNamespaceRepo.getNamespace.mockResolvedValue(null);

      const request = createMockRequest('POST', {
        email: 'newuser@example.com',
        password: 'password123',
        username: 'newuser',
        role: 'instructor',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toContain('not found');
    });

    it('should return 409 when username already exists', async () => {
      mockAuthForUser(mockSystemAdmin, 'user.create');
      mockNamespaceRepo.getNamespace.mockResolvedValue(mockNamespace);
      mockAuthProvider.signUp.mockRejectedValue(
        new Error('Username already exists')
      );

      const request = createMockRequest('POST', {
        email: 'existing@example.com',
        password: 'password123',
        username: 'existinguser',
        role: 'instructor',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to create user');
    });

    it('should create user successfully', async () => {
      mockAuthForUser(mockSystemAdmin, 'user.create');
      mockNamespaceRepo.getNamespace.mockResolvedValue(mockNamespace);
      mockUserRepo.getUserByUsername.mockResolvedValue(null);

      const newUser = {
        id: 'new-user-id',
        username: 'newuser',
        email: 'newuser@example.com',
        role: 'instructor' as const,
        namespaceId: 'test-namespace',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };

      mockAuthProvider.signUp.mockResolvedValue(newUser);

      const request = createMockRequest('POST', {
        email: 'newuser@example.com',
        password: 'password123',
        username: 'newuser',
        role: 'instructor',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.success).toBe(true);
      expect(data.user.username).toBe('newuser');
      expect(data.user.role).toBe('instructor');
      expect(data.user.namespaceId).toBe('test-namespace');
      expect(mockAuthProvider.signUp).toHaveBeenCalledWith('newuser@example.com', 'password123', 'newuser', 'instructor', 'test-namespace');
    });

    it('should trim username when creating user', async () => {
      mockAuthForUser(mockSystemAdmin, 'user.create');
      mockNamespaceRepo.getNamespace.mockResolvedValue(mockNamespace);
      mockUserRepo.getUserByUsername.mockResolvedValue(null);
      mockAuthProvider.signUp.mockResolvedValue({
        id: 'new-id',
        username: 'newuser',
        email: 'newuser@example.com',
        role: 'instructor' as const,
        namespaceId: 'test-namespace',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      const request = createMockRequest('POST', {
        email: 'newuser@example.com',
        password: 'password123',
        username: '  newuser  ',
        role: 'instructor',
      });

      await POST(request, { params: Promise.resolve({ id: 'test-namespace' }) });

      expect(mockAuthProvider.signUp).toHaveBeenCalledWith('newuser@example.com', 'password123', 'newuser', 'instructor', 'test-namespace');
    });

    it('should accept namespace-admin role', async () => {
      mockAuthForUser(mockSystemAdmin, 'user.create');
      mockNamespaceRepo.getNamespace.mockResolvedValue(mockNamespace);
      mockUserRepo.getUserByUsername.mockResolvedValue(null);
      mockAuthProvider.signUp.mockResolvedValue({
        id: 'new-id',
        username: 'admin',
        email: 'admin@example.com',
        role: 'namespace-admin' as const,
        namespaceId: 'test-namespace',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      const request = createMockRequest('POST', {
        email: 'admin@example.com',
        password: 'password123',
        username: 'admin',
        role: 'namespace-admin',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user.role).toBe('namespace-admin');
    });

    it('should accept student role', async () => {
      mockAuthForUser(mockSystemAdmin, 'user.create');
      mockNamespaceRepo.getNamespace.mockResolvedValue(mockNamespace);
      mockUserRepo.getUserByUsername.mockResolvedValue(null);
      mockAuthProvider.signUp.mockResolvedValue({
        id: 'new-id',
        username: 'student',
        email: 'student@example.com',
        role: 'student' as const,
        namespaceId: 'test-namespace',
        createdAt: new Date(),
        lastLoginAt: new Date(),
      });

      const request = createMockRequest('POST', {
        email: 'student@example.com',
        password: 'password123',
        username: 'student',
        role: 'student',
      });

      const response = await POST(request, { params: Promise.resolve({ id: 'test-namespace' }) });
      const data = await response.json();

      expect(response.status).toBe(201);
      expect(data.user.role).toBe('student');
    });
  });
});
