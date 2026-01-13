/**
 * Unit tests for SupabaseInvitationRepository
 *
 * Tests the invitation repository implementation against the Supabase backend.
 * Uses Jest mocks configured per-test for clean isolation.
 */

import { SupabaseInvitationRepository } from '../invitation-repository';
import {
  Invitation,
  CreateInvitationData,
  InvitationError,
} from '../../../invitations/types';

// Mock the Supabase client module
const mockSingle = jest.fn();
const mockLimit = jest.fn();
const mockOrder = jest.fn();

// Helper to create chainable mock
const createChainMock = () => {
  const chain: Record<string, jest.Mock> = {};

  chain.select = jest.fn().mockReturnValue(chain);
  chain.insert = jest.fn().mockReturnValue(chain);
  chain.update = jest.fn().mockReturnValue(chain);
  chain.eq = jest.fn().mockReturnValue(chain);
  chain.is = jest.fn().mockReturnValue(chain);
  chain.gt = jest.fn().mockReturnValue(chain);
  chain.lte = jest.fn().mockReturnValue(chain);
  chain.not = jest.fn().mockReturnValue(chain);
  chain.ilike = jest.fn().mockReturnValue(chain);
  chain.order = mockOrder;
  chain.single = mockSingle;
  chain.limit = mockLimit;

  return chain;
};

const mockFrom = jest.fn();

jest.mock('../../../supabase/client', () => ({
  getSupabaseClient: jest.fn(() => ({
    from: mockFrom,
  })),
}));

describe('SupabaseInvitationRepository', () => {
  let repository: SupabaseInvitationRepository;

  const mockInvitationRow = {
    id: 'invitation-123',
    email: 'user@example.com',
    supabase_user_id: null,
    target_role: 'instructor' as const,
    namespace_id: 'test-namespace',
    created_by: 'admin-123',
    created_at: '2026-01-01T00:00:00.000Z',
    expires_at: '2026-01-08T00:00:00.000Z',
    consumed_at: null,
    consumed_by: null,
    revoked_at: null,
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Reset chain mock setup for each test
    mockFrom.mockImplementation(() => createChainMock());

    repository = new SupabaseInvitationRepository();
  });

  describe('initialize', () => {
    it('successfully initializes with valid connection', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await repository.initialize();

      expect(mockFrom).toHaveBeenCalledWith('invitations');
    });

    it('throws error if connection fails', async () => {
      mockLimit.mockResolvedValue({
        data: null,
        error: { message: 'Connection failed' },
      });

      await expect(repository.initialize()).rejects.toThrow(
        'Failed to initialize InvitationRepository'
      );
    });

    it('only initializes once', async () => {
      mockLimit.mockResolvedValue({ data: [], error: null });

      await repository.initialize();
      await repository.initialize();

      expect(mockFrom).toHaveBeenCalledTimes(1);
    });
  });

  describe('createInvitation', () => {
    const validData: CreateInvitationData = {
      email: 'user@example.com',
      targetRole: 'instructor',
      namespaceId: 'test-namespace',
      createdBy: 'admin-123',
    };

    it('creates an invitation successfully', async () => {
      mockSingle.mockResolvedValue({
        data: mockInvitationRow,
        error: null,
      });

      const result = await repository.createInvitation(validData);

      expect(result.id).toBe('invitation-123');
      expect(result.email).toBe('user@example.com');
      expect(result.targetRole).toBe('instructor');
      expect(result.namespaceId).toBe('test-namespace');
      expect(mockFrom).toHaveBeenCalledWith('invitations');
    });

    it('normalizes email to lowercase', async () => {
      mockSingle.mockResolvedValue({
        data: mockInvitationRow,
        error: null,
      });

      await repository.createInvitation({
        ...validData,
        email: 'USER@EXAMPLE.COM',
      });

      // The insert should be called with normalized email
      expect(mockFrom).toHaveBeenCalledWith('invitations');
    });

    it('sets default expiry to 7 days', async () => {
      mockSingle.mockResolvedValue({
        data: mockInvitationRow,
        error: null,
      });

      const result = await repository.createInvitation(validData);

      // Verify result has expiresAt
      expect(result.expiresAt).toBeDefined();
    });

    it('uses provided expiry date', async () => {
      const customExpiry = new Date('2026-02-01T00:00:00.000Z');
      mockSingle.mockResolvedValue({
        data: {
          ...mockInvitationRow,
          expires_at: customExpiry.toISOString(),
        },
        error: null,
      });

      const result = await repository.createInvitation({
        ...validData,
        expiresAt: customExpiry,
      });

      expect(result.expiresAt.toISOString()).toBe(customExpiry.toISOString());
    });

    it('handles database errors during creation', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database connection lost' },
      });

      await expect(repository.createInvitation(validData)).rejects.toThrow(
        'Failed to create invitation'
      );
    });
  });

  describe('getInvitation', () => {
    it('retrieves an invitation successfully', async () => {
      mockSingle.mockResolvedValue({
        data: mockInvitationRow,
        error: null,
      });

      const result = await repository.getInvitation('invitation-123');

      expect(result).toBeDefined();
      expect(result!.id).toBe('invitation-123');
      expect(result!.email).toBe('user@example.com');
      expect(mockFrom).toHaveBeenCalledWith('invitations');
    });

    it('returns null if invitation not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await repository.getInvitation('nonexistent');

      expect(result).toBeNull();
    });

    it('handles database errors during retrieval', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(repository.getInvitation('invitation-123')).rejects.toThrow(
        'Failed to get invitation'
      );
    });
  });

  describe('getInvitationBySupabaseUserId', () => {
    it('retrieves an invitation by Supabase user ID', async () => {
      const rowWithSupabaseId = {
        ...mockInvitationRow,
        supabase_user_id: 'supabase-user-123',
      };

      mockSingle.mockResolvedValue({
        data: rowWithSupabaseId,
        error: null,
      });

      const result = await repository.getInvitationBySupabaseUserId('supabase-user-123');

      expect(result).toBeDefined();
      expect(result!.supabaseUserId).toBe('supabase-user-123');
    });

    it('returns null if not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await repository.getInvitationBySupabaseUserId('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('getPendingInvitationByEmail', () => {
    it('retrieves a pending invitation by email and namespace', async () => {
      // Mock a non-expired pending invitation
      const futureExpiry = new Date(Date.now() + 86400000).toISOString();
      mockSingle.mockResolvedValue({
        data: {
          ...mockInvitationRow,
          expires_at: futureExpiry,
        },
        error: null,
      });

      const result = await repository.getPendingInvitationByEmail(
        'user@example.com',
        'test-namespace'
      );

      expect(result).toBeDefined();
      expect(result!.email).toBe('user@example.com');
    });

    it('returns null if no pending invitation exists', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      const result = await repository.getPendingInvitationByEmail(
        'unknown@example.com',
        'test-namespace'
      );

      expect(result).toBeNull();
    });

    it('returns null for expired invitations', async () => {
      const pastExpiry = new Date('2020-01-01T00:00:00.000Z').toISOString();
      mockSingle.mockResolvedValue({
        data: {
          ...mockInvitationRow,
          expires_at: pastExpiry,
        },
        error: null,
      });

      const result = await repository.getPendingInvitationByEmail(
        'user@example.com',
        'test-namespace'
      );

      expect(result).toBeNull();
    });
  });

  describe('listInvitations', () => {
    it('lists all invitations successfully', async () => {
      mockOrder.mockResolvedValue({
        data: [mockInvitationRow],
        error: null,
      });

      const result = await repository.listInvitations();

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('invitation-123');
    });

    it('handles database errors during list', async () => {
      mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      await expect(repository.listInvitations()).rejects.toThrow(
        'Failed to list invitations'
      );
    });
  });

  describe('updateInvitation', () => {
    it('updates an invitation successfully', async () => {
      const updatedRow = {
        ...mockInvitationRow,
        supabase_user_id: 'new-supabase-id',
      };

      mockSingle.mockResolvedValue({
        data: updatedRow,
        error: null,
      });

      const result = await repository.updateInvitation('invitation-123', {
        supabaseUserId: 'new-supabase-id',
      });

      expect(result.supabaseUserId).toBe('new-supabase-id');
    });

    it('throws InvitationError if not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(
        repository.updateInvitation('nonexistent', { supabaseUserId: 'test' })
      ).rejects.toThrow(InvitationError);
    });

    it('handles database errors during update', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Update failed' },
      });

      await expect(
        repository.updateInvitation('invitation-123', { supabaseUserId: 'test' })
      ).rejects.toThrow('Failed to update invitation');
    });
  });

  describe('consumeInvitation', () => {
    it('marks invitation as consumed', async () => {
      const futureExpiry = new Date(Date.now() + 86400000);
      const pendingRow = {
        ...mockInvitationRow,
        expires_at: futureExpiry.toISOString(),
      };

      // First call: getInvitation
      mockSingle
        .mockResolvedValueOnce({
          data: pendingRow,
          error: null,
        })
        // Second call: updateInvitation
        .mockResolvedValueOnce({
          data: {
            ...pendingRow,
            consumed_at: new Date().toISOString(),
            consumed_by: 'user-456',
          },
          error: null,
        });

      const result = await repository.consumeInvitation('invitation-123', 'user-456');

      expect(result.consumedAt).toBeDefined();
      expect(result.consumedBy).toBe('user-456');
    });

    it('throws error for already consumed invitation', async () => {
      const consumedRow = {
        ...mockInvitationRow,
        consumed_at: '2026-01-02T00:00:00.000Z',
        consumed_by: 'other-user',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };

      mockSingle.mockResolvedValue({
        data: consumedRow,
        error: null,
      });

      await expect(
        repository.consumeInvitation('invitation-123', 'user-456')
      ).rejects.toThrow('already been consumed');
    });

    it('throws error for revoked invitation', async () => {
      const revokedRow = {
        ...mockInvitationRow,
        revoked_at: '2026-01-02T00:00:00.000Z',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };

      mockSingle.mockResolvedValue({
        data: revokedRow,
        error: null,
      });

      await expect(
        repository.consumeInvitation('invitation-123', 'user-456')
      ).rejects.toThrow('has been revoked');
    });

    it('throws error for expired invitation', async () => {
      const expiredRow = {
        ...mockInvitationRow,
        expires_at: '2020-01-01T00:00:00.000Z', // Past date
      };

      mockSingle.mockResolvedValue({
        data: expiredRow,
        error: null,
      });

      await expect(
        repository.consumeInvitation('invitation-123', 'user-456')
      ).rejects.toThrow('has expired');
    });

    it('throws error if invitation not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(
        repository.consumeInvitation('nonexistent', 'user-456')
      ).rejects.toThrow('not found');
    });
  });

  describe('revokeInvitation', () => {
    it('marks invitation as revoked', async () => {
      const futureExpiry = new Date(Date.now() + 86400000);
      const pendingRow = {
        ...mockInvitationRow,
        expires_at: futureExpiry.toISOString(),
      };

      mockSingle
        .mockResolvedValueOnce({
          data: pendingRow,
          error: null,
        })
        .mockResolvedValueOnce({
          data: {
            ...pendingRow,
            revoked_at: new Date().toISOString(),
          },
          error: null,
        });

      const result = await repository.revokeInvitation('invitation-123');

      expect(result.revokedAt).toBeDefined();
    });

    it('throws error for consumed invitation', async () => {
      const consumedRow = {
        ...mockInvitationRow,
        consumed_at: '2026-01-02T00:00:00.000Z',
        consumed_by: 'user-123',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };

      mockSingle.mockResolvedValue({
        data: consumedRow,
        error: null,
      });

      await expect(repository.revokeInvitation('invitation-123')).rejects.toThrow(
        'Cannot revoke a consumed invitation'
      );
    });

    it('is idempotent for already revoked invitation', async () => {
      const revokedRow = {
        ...mockInvitationRow,
        revoked_at: '2026-01-02T00:00:00.000Z',
        expires_at: new Date(Date.now() + 86400000).toISOString(),
      };

      mockSingle.mockResolvedValue({
        data: revokedRow,
        error: null,
      });

      const result = await repository.revokeInvitation('invitation-123');

      // Should return the already-revoked invitation without error
      expect(result.revokedAt).toBeDefined();
    });

    it('throws error if invitation not found', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' },
      });

      await expect(repository.revokeInvitation('nonexistent')).rejects.toThrow(
        'not found'
      );
    });
  });

  describe('countPendingInvitations', () => {
    it('counts pending invitations correctly', async () => {
      // Mock the count query
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({
                    count: 5,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const count = await repository.countPendingInvitations(
        'test-namespace',
        'instructor'
      );

      expect(count).toBe(5);
    });

    it('returns 0 when no pending invitations', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({
                    count: 0,
                    error: null,
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      const count = await repository.countPendingInvitations(
        'test-namespace',
        'namespace-admin'
      );

      expect(count).toBe(0);
    });

    it('handles database errors', async () => {
      mockFrom.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            eq: jest.fn().mockReturnValue({
              is: jest.fn().mockReturnValue({
                is: jest.fn().mockReturnValue({
                  gt: jest.fn().mockResolvedValue({
                    count: null,
                    error: { message: 'Count failed' },
                  }),
                }),
              }),
            }),
          }),
        }),
      });

      await expect(
        repository.countPendingInvitations('test-namespace', 'instructor')
      ).rejects.toThrow('Failed to count pending invitations');
    });
  });
});
