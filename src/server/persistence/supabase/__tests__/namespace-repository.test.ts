/**
 * Unit tests for SupabaseNamespaceRepository
 *
 * Tests the namespace repository implementation against the Supabase backend.
 * Uses Jest mocks configured per-test for clean isolation.
 */

import { SupabaseNamespaceRepository, isValidNamespaceId } from '../namespace-repository';
import { Namespace } from '../../../auth/types';

// Mock the Supabase client module
const mockFrom = jest.fn();
const mockSelect = jest.fn();
const mockInsert = jest.fn();
const mockUpdate = jest.fn();
const mockEq = jest.fn();
const mockSingle = jest.fn();
const mockLimit = jest.fn();
const mockUpdateEq = jest.fn(); // Separate mock for update().eq()

jest.mock('../../../supabase/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('isValidNamespaceId', () => {
  it('accepts valid namespace IDs', () => {
    expect(isValidNamespaceId('stanford')).toBe(true);
    expect(isValidNamespaceId('mit')).toBe(true);
    expect(isValidNamespaceId('cal-poly')).toBe(true);
    expect(isValidNamespaceId('uni-123')).toBe(true);
    expect(isValidNamespaceId('abc')).toBe(true); // Minimum length
    expect(isValidNamespaceId('a-very-long-namespace-id-32ch')).toBe(true); // 32 chars
  });

  it('rejects invalid namespace IDs', () => {
    // Too short
    expect(isValidNamespaceId('ab')).toBe(false);

    // Too long
    expect(isValidNamespaceId('this-namespace-id-is-way-too-long-for-validation')).toBe(false);

    // Invalid characters
    expect(isValidNamespaceId('Stanford')).toBe(false); // Uppercase
    expect(isValidNamespaceId('mit_edu')).toBe(false); // Underscore
    expect(isValidNamespaceId('cal poly')).toBe(false); // Space
    expect(isValidNamespaceId('mit!')).toBe(false); // Special char

    // Invalid format
    expect(isValidNamespaceId('-stanford')).toBe(false); // Starts with hyphen
    expect(isValidNamespaceId('stanford-')).toBe(false); // Ends with hyphen
    expect(isValidNamespaceId('stan--ford')).toBe(false); // Consecutive hyphens

    // Invalid input
    expect(isValidNamespaceId('')).toBe(false);
    expect(isValidNamespaceId(null as any)).toBe(false);
    expect(isValidNamespaceId(undefined as any)).toBe(false);
  });
});

describe('SupabaseNamespaceRepository', () => {
  let repository: SupabaseNamespaceRepository;

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
          limit: mockLimit,
        }),
        // INSERT chain: .insert().select().single()
        insert: jest.fn().mockReturnValue({
          select: jest.fn().mockReturnValue({
            single: mockSingle,
          }),
        }),
        // UPDATE chain: .update().eq() (returns Promise directly)
        update: jest.fn().mockReturnValue({
          eq: mockUpdateEq,
        }),
      };
    });

    repository = new SupabaseNamespaceRepository();
  });

  describe('initialize', () => {
    it('successfully initializes with valid connection', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await repository.initialize();

      expect(mockFrom).toHaveBeenCalledWith('namespaces');
    });

    it('throws error if connection fails', async () => {
      mockLimit.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' }
      });

      await expect(repository.initialize()).rejects.toThrow('Failed to initialize NamespaceRepository');
    });

    it('only initializes once', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await repository.initialize();
      await repository.initialize();

      expect(mockFrom).toHaveBeenCalledTimes(1);
    });
  });

  describe('createNamespace', () => {
    const validNamespace: Namespace = {
      id: 'stanford',
      displayName: 'Stanford University',
      active: true,
      createdAt: new Date('2024-01-01'),
      createdBy: 'user-123',
      updatedAt: new Date('2024-01-01'),
    };

    it('creates a namespace successfully', async () => {
      const mockRow = {
        id: 'stanford',
        display_name: 'Stanford University',
        active: true,
        created_at: '2024-01-01T00:00:00.000Z',
        created_by: 'user-123',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockSingle.mockResolvedValue({
        data: mockRow,
        error: null
      });

      const result = await repository.createNamespace(validNamespace);

      expect(result.id).toBe('stanford');
      expect(result.displayName).toBe('Stanford University');
      expect(mockFrom).toHaveBeenCalledWith('namespaces');
    });

    it('rejects invalid namespace ID', async () => {
      const invalidNamespace = { ...validNamespace, id: 'Invalid-ID' };

      await expect(repository.createNamespace(invalidNamespace)).rejects.toThrow('Invalid namespace ID');
    });

    it('handles duplicate namespace ID', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: '23505', message: 'duplicate key value' }
      });

      await expect(repository.createNamespace(validNamespace)).rejects.toThrow('Namespace already exists');
    });

    it('handles database errors during creation', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection lost' }
      });

      await expect(repository.createNamespace(validNamespace)).rejects.toThrow('Failed to create namespace');
    });
  });

  describe('getNamespace', () => {
    it('retrieves a namespace successfully', async () => {
      const mockRow = {
        id: 'stanford',
        display_name: 'Stanford University',
        active: true,
        created_at: '2024-01-01T00:00:00.000Z',
        created_by: 'user-123',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockSingle.mockResolvedValue({
        data: mockRow,
        error: null
      });

      const result = await repository.getNamespace('stanford');

      expect(result).toBeDefined();
      expect(result!.id).toBe('stanford');
      expect(mockFrom).toHaveBeenCalledWith('namespaces');
      expect(mockEq).toHaveBeenCalledWith('id', 'stanford');
    });

    it('returns null if namespace not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await repository.getNamespace('nonexistent');

      expect(result).toBeNull();
    });

    it('handles database errors during retrieval', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });

      await expect(repository.getNamespace('stanford')).rejects.toThrow('Failed to get namespace');
    });
  });

  describe('listNamespaces', () => {
    it('lists all namespaces successfully', async () => {
      const mockRows = [
        {
          id: 'stanford',
          display_name: 'Stanford University',
          active: true,
          created_at: '2024-01-01T00:00:00.000Z',
          created_by: 'user-123',
          updated_at: '2024-01-01T00:00:00.000Z',
        },
        {
          id: 'mit',
          display_name: 'MIT',
          active: true,
          created_at: '2024-01-02T00:00:00.000Z',
          created_by: 'user-456',
          updated_at: '2024-01-02T00:00:00.000Z',
        }
      ];

      // For listNamespaces: query = from().select().eq(), then await query
      // Override mockFrom to return an awaitable .eq()
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({ data: mockRows, error: null }),
        }),
      });

      const result = await repository.listNamespaces();

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('stanford');
      expect(result[1].id).toBe('mit');
      expect(mockFrom).toHaveBeenCalledWith('namespaces');
    });

    it('handles database errors during list', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockResolvedValue({
            data: null,
            error: { message: 'Database error' }
          }),
        }),
      });

      await expect(repository.listNamespaces()).rejects.toThrow('Failed to list namespaces');
    });
  });

  describe('updateNamespace', () => {
    it('updates a namespace successfully', async () => {
      const updates = { displayName: 'Stanford CS' };

      mockUpdateEq.mockResolvedValue({ data: null, error: null });

      await repository.updateNamespace('stanford', updates);

      expect(mockFrom).toHaveBeenCalledWith('namespaces');
    });

    it('handles database errors during update', async () => {
      mockUpdateEq.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' }
      });

      await expect(repository.updateNamespace('stanford', { displayName: 'New Name' }))
        .rejects.toThrow('Failed to update namespace');
    });
  });

  describe('deleteNamespace', () => {
    it('soft deletes a namespace', async () => {
      mockUpdateEq.mockResolvedValue({ data: null, error: null });

      await repository.deleteNamespace('stanford');

      expect(mockFrom).toHaveBeenCalledWith('namespaces');
    });

    it('handles database errors during deletion', async () => {
      mockUpdateEq.mockResolvedValue({
        data: null,
        error: { message: 'Delete failed' }
      });

      await expect(repository.deleteNamespace('stanford')).rejects.toThrow('Failed to delete namespace');
    });
  });

  describe('namespaceExists', () => {
    it('returns true if namespace exists', async () => {
      const mockRow = {
        id: 'stanford',
        display_name: 'Stanford University',
        active: true,
        created_at: '2024-01-01T00:00:00.000Z',
        created_by: 'user-123',
        updated_at: '2024-01-01T00:00:00.000Z',
      };

      mockSingle.mockResolvedValue({
        data: mockRow,
        error: null
      });

      const result = await repository.namespaceExists('stanford');

      expect(result).toBe(true);
    });

    it('returns false if namespace does not exist', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: null
      });

      const result = await repository.namespaceExists('nonexistent');

      expect(result).toBe(false);
    });

    it('handles database errors during existence check', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Query failed' }
      });

      // namespaceExists calls getNamespace internally, so we get that error message
      await expect(repository.namespaceExists('stanford')).rejects.toThrow('Failed to get namespace');
    });
  });
});
