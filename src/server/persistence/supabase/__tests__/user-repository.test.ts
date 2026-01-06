/**
 * Unit tests for SupabaseUserRepository
 *
 * Tests the user repository implementation against the Supabase backend.
 * Uses Jest mocks configured per-test for clean isolation.
 */

import { SupabaseUserRepository } from '../user-repository';
import { User, UserRole } from '../../../auth/types';

// Mock the Supabase client module
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpsert = jest.fn();
const mockUpdate = jest.fn();
const mockDelete = jest.fn();
const mockEq = jest.fn();
const mockIs = jest.fn();
const mockSingle = jest.fn();
const mockLimit = jest.fn();

jest.mock('../../../supabase/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('SupabaseUserRepository', () => {
  let repository: SupabaseUserRepository;

  const mockUser: User = {
    id: 'user-123',
    username: 'jdoe',
      email: "test@example.com",
    emailConfirmed: false,
    role: 'instructor' as UserRole,
    namespaceId: 'stanford',
    displayName: 'John Doe',
    createdAt: new Date('2025-01-01T00:00:00Z'),
    lastLoginAt: new Date('2025-01-05T10:30:00Z'),
  };

  const mockUserRow = {
    id: mockUser.id,
    username: mockUser.username,
    email: mockUser.email,
    email_confirmed: false,
    role: mockUser.role,
    namespace_id: mockUser.namespaceId,
    display_name: mockUser.displayName,
    created_at: mockUser.createdAt.toISOString(),
    last_login_at: mockUser.lastLoginAt?.toISOString(),
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Set up default mock chain for common patterns
    mockFrom.mockImplementation((table: string) => {
      return {
        // SELECT chain: .select().eq().single() OR .select().limit()
        select: jest.fn().mockReturnValue({
          eq: mockEq.mockReturnValue({
            single: mockSingle,
          }),
          is: mockIs,
          limit: mockLimit,
        }),
        // UPSERT chain: .upsert()
        upsert: mockUpsert,
        // UPDATE chain: .update().eq()
        update: jest.fn().mockReturnValue({
          eq: mockEq,
        }),
        // DELETE chain: .delete().eq()
        delete: jest.fn().mockReturnValue({
          eq: mockEq,
        }),
      };
    });

    repository = new SupabaseUserRepository();
  });

  describe('initialize', () => {
    it('should initialize successfully', async () => {
      // Setup: Mock a successful query
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      await expect(repository.initialize()).resolves.not.toThrow();
    });

    it('should throw error if initialization fails', async () => {
      // Setup: Mock a failed query
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection failed' },
          }),
        }),
      });

      await expect(repository.initialize()).rejects.toThrow(
        'Failed to initialize UserRepository: Connection failed'
      );
    });

    it('should not initialize twice', async () => {
      // Setup: Mock successful query
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      await repository.initialize();
      await repository.initialize();

      // Should only call once
      expect(mockFrom).toHaveBeenCalledTimes(1);
    });
  });

  describe('saveUser', () => {
    it('should save a new user', async () => {
      mockUpsert.mockResolvedValue({ data: null, error: null });

      await repository.saveUser(mockUser);

      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      expect(mockUpsert).toHaveBeenCalledWith(
        {
          id: mockUser.id,
          email: mockUser.email,
          username: mockUser.username,
          role: mockUser.role,
          namespace_id: mockUser.namespaceId,
          display_name: mockUser.displayName,
          created_at: mockUser.createdAt.toISOString(),
          last_login_at: mockUser.lastLoginAt?.toISOString(),
          email_confirmed: mockUser.emailConfirmed,
        },
        { onConflict: 'id' }
      );
    });

    it('should save a user without optional fields', async () => {
      const minimalUser: User = {
        id: 'user-456',
        username: 'minimal',
      email: "test@example.com",
        role: 'student',
        namespaceId: 'stanford',
        createdAt: new Date('2025-01-01T00:00:00Z'),
      };

      mockUpsert.mockResolvedValue({ data: null, error: null });

      await repository.saveUser(minimalUser);

      expect(mockUpsert).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: null,
          last_login_at: null,
        }),
        { onConflict: 'id' }
      );
    });

    it('should throw error on save failure', async () => {
      mockUpsert.mockResolvedValue({
        data: null,
        error: { message: 'Duplicate username' },
      });

      await expect(repository.saveUser(mockUser)).rejects.toThrow(
        'Failed to save user: Duplicate username'
      );
    });
  });

  describe('getUser', () => {
    it('should get a user by ID', async () => {
      mockSingle.mockResolvedValue({ data: mockUserRow, error: null });

      const result = await repository.getUser(mockUser.id);

      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      expect(mockEq).toHaveBeenCalledWith('id', mockUser.id);
      expect(result).toEqual(mockUser);
    });

    it('should return null if user not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await repository.getUser('nonexistent');

      expect(result).toBeNull();
    });

    it('should throw error on query failure', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'OTHER', message: 'Database error' },
      });

      await expect(repository.getUser(mockUser.id)).rejects.toThrow(
        'Failed to get user: Database error'
      );
    });
  });

  describe('getUserByUsername', () => {
    it('should get a user by username', async () => {
      mockSingle.mockResolvedValue({ data: mockUserRow, error: null });

      const result = await repository.getUserByUsername(mockUser.username);

      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      expect(mockEq).toHaveBeenCalledWith('username', mockUser.username);
      expect(result).toEqual(mockUser);
    });

    it('should return null if username not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116', message: 'Not found' },
      });

      const result = await repository.getUserByUsername('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getUserByEmail', () => {
    it('should get a user by email (delegates to getUserByUsername)', async () => {
      mockSingle.mockResolvedValue({ data: mockUserRow, error: null });

      const result = await repository.getUserByEmail(mockUser.username);

      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      expect(mockEq).toHaveBeenCalledWith('username', mockUser.username);
      expect(result).toEqual(mockUser);
    });
  });

  describe('listUsers', () => {
    const mockUsers: User[] = [
      mockUser,
      {
        id: 'user-456',
        email: 'jsmith@example.com',
        emailConfirmed: false,
        username: 'jsmith',
        role: 'student',
        namespaceId: 'stanford',
        createdAt: new Date('2025-01-02T00:00:00Z'),
      },
    ];

    const mockUserRows = mockUsers.map((u) => ({
      id: u.id,
      username: u.username,
      email: u.email,
      email_confirmed: u.emailConfirmed || false,
      role: u.role,
      namespace_id: u.namespaceId,
      display_name: u.displayName || null,
      created_at: u.createdAt.toISOString(),
      last_login_at: u.lastLoginAt?.toISOString() || null,
    }));

    it('should list all users without filters', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: mockUserRows, error: null }),
      });

      const result = await repository.listUsers();

      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      expect(result).toHaveLength(2);
      expect(result[0]).toEqual(mockUsers[0]);
      expect(result[1]).toEqual(mockUsers[1]);
    });

    it('should list users filtered by role', async () => {
      const studentRows = [mockUserRows[1]];
      const selectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: studentRows, error: null }),
      });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.listUsers('student');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('student');
    });

    it('should list users filtered by namespace', async () => {
      const selectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: mockUserRows, error: null }),
      });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.listUsers(undefined, 'stanford');

      expect(result).toHaveLength(2);
    });

    it('should list system-admin users (null namespace)', async () => {
      const adminRow = {
        id: 'admin-1',
        username: 'admin',
        role: 'system-admin',
        namespace_id: null,
        display_name: 'System Admin',
        created_at: new Date('2025-01-01T00:00:00Z').toISOString(),
        last_login_at: null,
      };

      const selectFn = jest.fn().mockReturnValue({
        is: jest.fn().mockResolvedValue({ data: [adminRow], error: null }),
      });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.listUsers(undefined, null);

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('system-admin');
      expect(result[0].namespaceId).toBeNull();
    });

    it('should list users filtered by both role and namespace', async () => {
      // When both filters are applied, we need to chain .eq() twice
      const secondEq = jest.fn().mockResolvedValue({ data: [mockUserRows[1]], error: null });
      const firstEq = jest.fn().mockReturnValue({ eq: secondEq });
      const selectFn = jest.fn().mockReturnValue({ eq: firstEq });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.listUsers('student', 'stanford');

      expect(result).toHaveLength(1);
      expect(result[0].role).toBe('student');
    });

    it('should return empty array if no users found', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({ data: [], error: null }),
      });

      const result = await repository.listUsers();

      expect(result).toEqual([]);
    });

    it('should throw error on query failure', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockResolvedValue({
          data: null,
          error: { message: 'Database error' },
        }),
      });

      await expect(repository.listUsers()).rejects.toThrow(
        'Failed to list users: Database error'
      );
    });
  });

  describe('getUsersByNamespace', () => {
    it('should delegate to listUsers with namespace filter', async () => {
      const mockUserRows = [mockUserRow];

      const selectFn = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: mockUserRows, error: null }),
      });

      mockFrom.mockReturnValue({
        select: selectFn,
      });

      const result = await repository.getUsersByNamespace('stanford');

      expect(result).toHaveLength(1);
      expect(result[0].namespaceId).toBe('stanford');
    });
  });

  describe('updateUser', () => {
    it('should update user fields', async () => {
      mockEq.mockResolvedValue({ data: null, error: null });

      const updates: Partial<User> = {
        displayName: 'Jane Doe',
        role: 'namespace-admin',
      };

      await repository.updateUser(mockUser.id, updates);

      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      const updateCall = mockFrom.mock.results[0].value.update;
      expect(updateCall).toHaveBeenCalledWith({
        display_name: 'Jane Doe',
        role: 'namespace-admin',
      });
      expect(mockEq).toHaveBeenCalledWith('id', mockUser.id);
    });

    it('should update username', async () => {
      mockEq.mockResolvedValue({ data: null, error: null });

      await repository.updateUser(mockUser.id, { username: 'newusername' });

      const updateCall = mockFrom.mock.results[0].value.update;
      expect(updateCall).toHaveBeenCalledWith({ username: 'newusername' });
    });

    it('should update namespace', async () => {
      mockEq.mockResolvedValue({ data: null, error: null });

      await repository.updateUser(mockUser.id, { namespaceId: 'mit' });

      const updateCall = mockFrom.mock.results[0].value.update;
      expect(updateCall).toHaveBeenCalledWith({ namespace_id: 'mit' });
    });

    it('should update lastLoginAt', async () => {
      mockEq.mockResolvedValue({ data: null, error: null });

      const newLoginTime = new Date('2025-01-06T12:00:00Z');
      await repository.updateUser(mockUser.id, { lastLoginAt: newLoginTime });

      const updateCall = mockFrom.mock.results[0].value.update;
      expect(updateCall).toHaveBeenCalledWith({
        last_login_at: newLoginTime.toISOString(),
      });
    });

    it('should throw error on update failure', async () => {
      const updateEq = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      mockFrom.mockReturnValue({
        update: jest.fn().mockReturnValue({
          eq: updateEq,
        }),
      });

      await expect(repository.updateUser(mockUser.id, { displayName: 'New Name' })).rejects.toThrow(
        'Failed to update user: Update failed'
      );
    });
  });

  describe('deleteUser', () => {
    it('should delete a user', async () => {
      mockEq.mockResolvedValue({ data: null, error: null });

      await repository.deleteUser(mockUser.id);

      expect(mockFrom).toHaveBeenCalledWith('user_profiles');
      expect(mockEq).toHaveBeenCalledWith('id', mockUser.id);
    });

    it('should throw error on delete failure', async () => {
      const deleteEq = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' },
      });

      mockFrom.mockReturnValue({
        delete: jest.fn().mockReturnValue({
          eq: deleteEq,
        }),
      });

      await expect(repository.deleteUser(mockUser.id)).rejects.toThrow(
        'Failed to delete user: Delete failed'
      );
    });
  });

  describe('health', () => {
    it('should return true if database is accessible', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      const result = await repository.health();

      expect(result).toBe(true);
    });

    it('should return false if database query fails', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Connection error' },
          }),
        }),
      });

      const result = await repository.health();

      expect(result).toBe(false);
    });

    it('should return false if exception is thrown', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Connection error');
      });

      const result = await repository.health();

      expect(result).toBe(false);
    });
  });

  describe('shutdown', () => {
    it('should shutdown gracefully', async () => {
      await expect(repository.shutdown()).resolves.not.toThrow();
    });

    it('should allow reinitialization after shutdown', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          limit: jest.fn().mockResolvedValue({ data: [], error: null }),
        }),
      });

      await repository.initialize();
      await repository.shutdown();
      await repository.initialize();

      expect(mockFrom).toHaveBeenCalledTimes(2);
    });
  });
});
