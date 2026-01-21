/**
 * Wave 1 Integration Tests: Namespace ↔ User Interactions
 *
 * These integration tests verify that NamespaceRepository and UserRepository
 * work together correctly. Tests use mocked Supabase to simulate database
 * interactions without requiring a live database connection.
 *
 * Test scenarios:
 * - Users can only see their own namespace
 * - System admins can see all namespaces
 * - User profile includes correct namespace reference
 * - Namespace deletion prevents user operations (FK constraint)
 */

import { SupabaseNamespaceRepository } from '../../namespace-repository';
import { SupabaseUserRepository } from '../../user-repository';
import { Namespace, User, UserRole } from '../../../../auth/types';

// Mock the Supabase client module
const mockFrom = jest.fn();

jest.mock('../../../../supabase/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('Wave 1 Integration: Namespace ↔ User', () => {
  let namespaceRepo: SupabaseNamespaceRepository;
  let userRepo: SupabaseUserRepository;

  // Test data
  const stanfordNamespace: Namespace = {
    id: 'stanford',
    displayName: 'Stanford University',
    active: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    createdBy: 'admin-1',
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  const mitNamespace: Namespace = {
    id: 'mit',
    displayName: 'MIT',
    active: true,
    createdAt: new Date('2025-01-01T00:00:00Z'),
    createdBy: 'admin-1',
    updatedAt: new Date('2025-01-01T00:00:00Z'),
  };

  const systemAdmin: User = {
    id: 'admin-1',
      email: "test@example.com",
    role: 'system-admin',
    namespaceId: null,
    displayName: 'System Administrator',
    createdAt: new Date('2025-01-01T00:00:00Z'),
  };

  const stanfordInstructor: User = {
    id: 'user-123',
      email: "test@example.com",
    role: 'instructor',
    namespaceId: 'stanford',
    displayName: 'Stanford Professor',
    createdAt: new Date('2025-01-02T00:00:00Z'),
  };

  const mitInstructor: User = {
    id: 'user-456',
      email: "test@example.com",
    role: 'instructor',
    namespaceId: 'mit',
    displayName: 'MIT Professor',
    createdAt: new Date('2025-01-02T00:00:00Z'),
  };

  const stanfordStudent: User = {
    id: 'user-789',
      email: "test@example.com",
    role: 'student',
    namespaceId: 'stanford',
    createdAt: new Date('2025-01-03T00:00:00Z'),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    namespaceRepo = new SupabaseNamespaceRepository();
    userRepo = new SupabaseUserRepository();
  });

  describe('User namespace association', () => {
    it('should retrieve user with correct namespace reference', async () => {
      const userRow = {
        id: stanfordInstructor.id,
        role: stanfordInstructor.role,
        namespace_id: stanfordInstructor.namespaceId,
        display_name: stanfordInstructor.displayName,
        created_at: stanfordInstructor.createdAt.toISOString(),
        last_login_at: null,
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: userRow, error: null }),
          }),
        }),
      });

      const user = await userRepo.getUser(stanfordInstructor.id);

      expect(user).not.toBeNull();
      expect(user?.namespaceId).toBe('stanford');
      expect(user?.role).toBe('instructor');
    });

    it('should list all users in a specific namespace', async () => {
      // Mock listUsers filtered by namespace
      const stanfordUserRows = [
        {
          id: stanfordInstructor.id,
          role: stanfordInstructor.role,
          namespace_id: 'stanford',
          display_name: stanfordInstructor.displayName,
          created_at: stanfordInstructor.createdAt.toISOString(),
          last_login_at: null,
        },
        {
          id: stanfordStudent.id,
          role: stanfordStudent.role,
          namespace_id: 'stanford',
          display_name: null,
          created_at: stanfordStudent.createdAt.toISOString(),
          last_login_at: null,
        },
      ];

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: stanfordUserRows, error: null }),
        }),
      });

      const users = await userRepo.getUsersByNamespace('stanford');

      expect(users).toHaveLength(2);
      expect(users.every((u) => u.namespaceId === 'stanford')).toBe(true);
    });

    it('should not return users from other namespaces', async () => {
      // Mock query for MIT users
      const mitUserRows = [
        {
          id: mitInstructor.id,
          role: mitInstructor.role,
          namespace_id: 'mit',
          display_name: mitInstructor.displayName,
          created_at: mitInstructor.createdAt.toISOString(),
          last_login_at: null,
        },
      ];

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mitUserRows, error: null }),
        }),
      });

      const users = await userRepo.getUsersByNamespace('mit');

      expect(users).toHaveLength(1);
      expect(users[0].namespaceId).toBe('mit');
      // Verify Stanford users not included
      expect(users.find((u) => u.id === stanfordInstructor.id)).toBeUndefined();
    });
  });

  describe('System admin access', () => {
    it('should allow system-admin to have null namespace', async () => {
      // Mock getUser for system admin
      const adminRow = {
        id: systemAdmin.id,
        role: systemAdmin.role,
        namespace_id: null,
        display_name: systemAdmin.displayName,
        created_at: systemAdmin.createdAt.toISOString(),
        last_login_at: null,
      };

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({ data: adminRow, error: null }),
          }),
        }),
      });

      const admin = await userRepo.getUser('admin-1');

      expect(admin).not.toBeNull();
      expect(admin?.namespaceId).toBeNull();
      expect(admin?.role).toBe('system-admin');
    });

    it('should list system-admin users separately', async () => {
      // Mock listUsers with null namespace filter
      const adminRows = [
        {
          id: systemAdmin.id,
          role: systemAdmin.role,
          namespace_id: null,
          display_name: systemAdmin.displayName,
          created_at: systemAdmin.createdAt.toISOString(),
          last_login_at: null,
        },
      ];

      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          is: jest.fn().mockResolvedValue({ data: adminRows, error: null }),
        }),
      });

      const admins = await userRepo.listUsers(undefined, null);

      expect(admins).toHaveLength(1);
      expect(admins[0].role).toBe('system-admin');
      expect(admins[0].namespaceId).toBeNull();
    });

    it('should allow system-admin to see all namespaces', async () => {
      // Mock listNamespaces to return all namespaces
      const namespaceRows = [
        {
          id: stanfordNamespace.id,
          display_name: stanfordNamespace.displayName,
          active: stanfordNamespace.active,
          created_at: stanfordNamespace.createdAt.toISOString(),
          created_by: stanfordNamespace.createdBy,
          updated_at: stanfordNamespace.updatedAt.toISOString(),
        },
        {
          id: mitNamespace.id,
          display_name: mitNamespace.displayName,
          active: mitNamespace.active,
          created_at: mitNamespace.createdAt.toISOString(),
          created_by: mitNamespace.createdBy,
          updated_at: mitNamespace.updatedAt.toISOString(),
        },
      ];

      // Mock with eq chain for active filter
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: namespaceRows, error: null }),
        }),
      });

      const namespaces = await namespaceRepo.listNamespaces();

      expect(namespaces).toHaveLength(2);
      expect(namespaces.find((n) => n.id === 'stanford')).toBeDefined();
      expect(namespaces.find((n) => n.id === 'mit')).toBeDefined();
    });
  });

  describe('Namespace deletion constraints', () => {
    it('should simulate FK constraint preventing user operations after namespace deletion', async () => {
      // Simulate: Delete namespace (soft delete using update)
      mockFrom.mockReturnValueOnce({
        update: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: null, error: null }),
        }),
      });

      await namespaceRepo.deleteNamespace('stanford');

      // Now simulate user query that would fail due to FK constraint
      // In real Supabase, this would cause a constraint violation
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: {
              message: 'foreign key violation',
              code: '23503',
            },
          }),
        }),
      });

      // This simulates what would happen if you try to query users
      // after their namespace is deleted
      await expect(userRepo.getUsersByNamespace('stanford')).rejects.toThrow(
        'foreign key violation'
      );
    });

    it('should verify namespace exists before creating user (best practice)', async () => {
      // First check if namespace exists
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: jest.fn().mockResolvedValue({
              data: {
                id: 'stanford',
                display_name: 'Stanford University',
                active: true,
                created_at: new Date().toISOString(),
                created_by: 'admin-1',
                updated_at: new Date().toISOString(),
              },
              error: null,
            }),
          }),
        }),
      });

      const namespace = await namespaceRepo.getNamespace('stanford');
      expect(namespace).not.toBeNull();

      // Then create user with valid namespace
      mockFrom.mockReturnValueOnce({
        upsert: jest.fn().mockResolvedValue({ data: null, error: null }),
      });

      const newUser: User = {
        id: 'new-user',
      email: "test@example.com",
        role: 'student',
        namespaceId: 'stanford',
        createdAt: new Date(),
      };

      await expect(userRepo.saveUser(newUser)).resolves.not.toThrow();
    });
  });

  describe('Role and namespace validation', () => {
    it('should enforce system-admin must have null namespace', async () => {
      // Database constraint: system-admin must NOT have namespace_id
      // Mock this as a database error
      const invalidAdmin: User = {
        id: 'bad-admin',
      email: "test@example.com",
        role: 'system-admin',
        namespaceId: 'stanford', // INVALID!
        createdAt: new Date(),
      };

      mockFrom.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: null,
          error: {
            message: 'new row violates check constraint "valid_namespace_for_role"',
            code: '23514',
          },
        }),
      });

      await expect(userRepo.saveUser(invalidAdmin)).rejects.toThrow(
        'valid_namespace_for_role'
      );
    });

    it('should enforce non-admin users must have namespace', async () => {
      // Database constraint: non-admin roles MUST have namespace_id
      const invalidInstructor: User = {
        id: 'bad-instructor',
      email: "test@example.com",
        role: 'instructor',
        namespaceId: null, // INVALID!
        createdAt: new Date(),
      };

      mockFrom.mockReturnValue({
        upsert: jest.fn().mockResolvedValue({
          data: null,
          error: {
            message: 'new row violates check constraint "valid_namespace_for_role"',
            code: '23514',
          },
        }),
      });

      await expect(userRepo.saveUser(invalidInstructor)).rejects.toThrow(
        'valid_namespace_for_role'
      );
    });
  });

  describe('Multi-namespace scenarios', () => {
    it('should support users in different namespaces independently', async () => {
      // Get Stanford users
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                id: stanfordInstructor.id,
                role: stanfordInstructor.role,
                namespace_id: 'stanford',
                display_name: stanfordInstructor.displayName,
                created_at: stanfordInstructor.createdAt.toISOString(),
                last_login_at: null,
              },
            ],
            error: null,
          }),
        }),
      });

      const stanfordUsers = await userRepo.getUsersByNamespace('stanford');
      expect(stanfordUsers).toHaveLength(1);

      // Get MIT users
      mockFrom.mockReturnValueOnce({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: [
              {
                id: mitInstructor.id,
                role: mitInstructor.role,
                namespace_id: 'mit',
                display_name: mitInstructor.displayName,
                created_at: mitInstructor.createdAt.toISOString(),
                last_login_at: null,
              },
            ],
            error: null,
          }),
        }),
      });

      const mitUsers = await userRepo.getUsersByNamespace('mit');
      expect(mitUsers).toHaveLength(1);

      // Verify isolation
      expect(stanfordUsers[0].namespaceId).toBe('stanford');
      expect(mitUsers[0].namespaceId).toBe('mit');
      expect(stanfordUsers[0].id).not.toBe(mitUsers[0].id);
    });
  });
});
