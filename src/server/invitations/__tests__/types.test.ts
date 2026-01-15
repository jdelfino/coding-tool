/**
 * Unit tests for invitation types and helper functions
 */

import {
  Invitation,
  InvitationError,
  getInvitationStatus,
  InvitationStatus,
  InvitableRole,
} from '../types';

describe('Invitation Types', () => {
  const createBaseInvitation = (overrides: Partial<Invitation> = {}): Invitation => ({
    id: 'test-invitation-id',
    email: 'user@example.com',
    targetRole: 'instructor',
    namespaceId: 'test-namespace',
    createdBy: 'admin-user-id',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    expiresAt: new Date('2026-01-08T00:00:00Z'), // 7 days later
    ...overrides,
  });

  describe('getInvitationStatus', () => {
    it('should return "pending" for invitation with no status timestamps', () => {
      const invitation = createBaseInvitation({
        expiresAt: new Date(Date.now() + 86400000), // Tomorrow
      });

      expect(getInvitationStatus(invitation)).toBe('pending');
    });

    it('should return "consumed" when consumedAt is set', () => {
      const invitation = createBaseInvitation({
        consumedAt: new Date('2026-01-02T00:00:00Z'),
        consumedBy: 'accepted-user-id',
        expiresAt: new Date(Date.now() + 86400000), // Not expired
      });

      expect(getInvitationStatus(invitation)).toBe('consumed');
    });

    it('should return "revoked" when revokedAt is set', () => {
      const invitation = createBaseInvitation({
        revokedAt: new Date('2026-01-02T00:00:00Z'),
        expiresAt: new Date(Date.now() + 86400000), // Not expired
      });

      expect(getInvitationStatus(invitation)).toBe('revoked');
    });

    it('should return "expired" when expiresAt is in the past', () => {
      const invitation = createBaseInvitation({
        expiresAt: new Date('2020-01-01T00:00:00Z'), // Past date
      });

      expect(getInvitationStatus(invitation)).toBe('expired');
    });

    it('should prioritize revoked over consumed', () => {
      // Edge case: both timestamps set (shouldn't happen, but test precedence)
      const invitation = createBaseInvitation({
        revokedAt: new Date('2026-01-02T00:00:00Z'),
        consumedAt: new Date('2026-01-03T00:00:00Z'),
        expiresAt: new Date(Date.now() + 86400000),
      });

      expect(getInvitationStatus(invitation)).toBe('revoked');
    });

    it('should prioritize consumed over expired', () => {
      // If consumed before expiry, it's consumed even if now past expiry
      const invitation = createBaseInvitation({
        consumedAt: new Date('2026-01-02T00:00:00Z'),
        consumedBy: 'accepted-user-id',
        expiresAt: new Date('2020-01-01T00:00:00Z'), // Past date
      });

      expect(getInvitationStatus(invitation)).toBe('consumed');
    });

    it('should handle invitation expiring at exact current time', () => {
      const now = new Date();
      const invitation = createBaseInvitation({
        expiresAt: now, // Exactly now - should be expired
      });

      // Since comparison is strict greater-than, exactly now is expired
      const status = getInvitationStatus(invitation);
      // At exact boundary, could be pending or expired depending on timing
      expect(['pending', 'expired']).toContain(status);
    });
  });

  describe('InvitationError', () => {
    it('should create error with correct name', () => {
      const error = new InvitationError('Test error', 'INVITATION_NOT_FOUND');

      expect(error.name).toBe('InvitationError');
      expect(error.message).toBe('Test error');
      expect(error.code).toBe('INVITATION_NOT_FOUND');
    });

    it('should support all error codes', () => {
      const errorCodes: InvitationError['code'][] = [
        'INVITATION_NOT_FOUND',
        'INVITATION_EXPIRED',
        'INVITATION_CONSUMED',
        'INVITATION_REVOKED',
        'DUPLICATE_INVITATION',
        'NAMESPACE_AT_CAPACITY',
        'INVALID_EMAIL',
      ];

      errorCodes.forEach(code => {
        const error = new InvitationError(`Error: ${code}`, code);
        expect(error.code).toBe(code);
        expect(error).toBeInstanceOf(Error);
        expect(error).toBeInstanceOf(InvitationError);
      });
    });

    it('should be catchable as Error', () => {
      const error = new InvitationError('Test', 'INVITATION_NOT_FOUND');

      expect(() => {
        throw error;
      }).toThrow(Error);
    });

    it('should preserve stack trace', () => {
      const error = new InvitationError('Test', 'INVITATION_NOT_FOUND');

      expect(error.stack).toBeDefined();
      expect(error.stack).toContain('InvitationError');
    });
  });

  describe('Type constraints', () => {
    it('should only allow valid invitable roles', () => {
      // This is a compile-time check, but we can verify runtime
      const validRoles: InvitableRole[] = ['namespace-admin', 'instructor'];

      validRoles.forEach(role => {
        const invitation = createBaseInvitation({ targetRole: role });
        expect(['namespace-admin', 'instructor']).toContain(invitation.targetRole);
      });
    });

    it('should only allow valid invitation statuses', () => {
      const validStatuses: InvitationStatus[] = ['pending', 'consumed', 'revoked', 'expired'];

      validStatuses.forEach(status => {
        expect(['pending', 'consumed', 'revoked', 'expired']).toContain(status);
      });
    });
  });

  describe('Invitation interface', () => {
    it('should allow optional supabaseUserId', () => {
      const withoutSupabaseId = createBaseInvitation();
      expect(withoutSupabaseId.supabaseUserId).toBeUndefined();

      const withSupabaseId = createBaseInvitation({
        supabaseUserId: 'supabase-auth-user-id',
      });
      expect(withSupabaseId.supabaseUserId).toBe('supabase-auth-user-id');
    });

    it('should allow optional consumed fields', () => {
      const pending = createBaseInvitation();
      expect(pending.consumedAt).toBeUndefined();
      expect(pending.consumedBy).toBeUndefined();

      const consumed = createBaseInvitation({
        consumedAt: new Date(),
        consumedBy: 'user-id',
      });
      expect(consumed.consumedAt).toBeDefined();
      expect(consumed.consumedBy).toBe('user-id');
    });

    it('should allow optional revokedAt', () => {
      const active = createBaseInvitation();
      expect(active.revokedAt).toBeUndefined();

      const revoked = createBaseInvitation({
        revokedAt: new Date(),
      });
      expect(revoked.revokedAt).toBeDefined();
    });
  });
});
