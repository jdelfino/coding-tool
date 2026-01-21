/**
 * Supabase-backed invitation repository implementation
 *
 * Implements invitation CRUD operations using Supabase as the storage backend.
 * Token management is handled separately by Supabase Auth (inviteUserByEmail()).
 *
 * Supports RLS-backed access control when accessToken is provided.
 */

import {
  Invitation,
  CreateInvitationData,
  InvitationFilters,
  InvitationError,
  getInvitationStatus,
} from '../../invitations/types';
import { IInvitationRepository } from '../../invitations/interfaces';
import { getClient } from '../../supabase/client';

/**
 * Database row type for invitations table
 */
interface InvitationRow {
  id: string;
  email: string;
  supabase_user_id: string | null;
  target_role: 'namespace-admin' | 'instructor';
  namespace_id: string;
  created_by: string;
  created_at: string;
  expires_at: string;
  consumed_at: string | null;
  consumed_by: string | null;
  revoked_at: string | null;
}

/**
 * Maps a database row to an Invitation domain object
 */
function mapRowToInvitation(row: InvitationRow): Invitation {
  return {
    id: row.id,
    email: row.email,
    supabaseUserId: row.supabase_user_id ?? undefined,
    targetRole: row.target_role,
    namespaceId: row.namespace_id,
    createdBy: row.created_by,
    createdAt: new Date(row.created_at),
    expiresAt: new Date(row.expires_at),
    consumedAt: row.consumed_at ? new Date(row.consumed_at) : undefined,
    consumedBy: row.consumed_by ?? undefined,
    revokedAt: row.revoked_at ? new Date(row.revoked_at) : undefined,
  };
}

/**
 * Default expiry period for invitations (7 days)
 */
const DEFAULT_EXPIRY_DAYS = 7;

/**
 * Supabase implementation of IInvitationRepository
 */
export class SupabaseInvitationRepository implements IInvitationRepository {
  private initialized = false;
  private readonly accessToken?: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection
    const supabase = getClient(this.accessToken);
    const { error } = await supabase.from('invitations').select('id').limit(1);

    if (error) {
      throw new Error(`Failed to initialize InvitationRepository: ${error.message}`);
    }

    this.initialized = true;
  }

  async createInvitation(data: CreateInvitationData): Promise<Invitation> {
    const supabase = getClient(this.accessToken);

    const now = new Date();
    const expiresAt = data.expiresAt ?? new Date(now.getTime() + DEFAULT_EXPIRY_DAYS * 24 * 60 * 60 * 1000);

    const insertData = {
      email: data.email.toLowerCase().trim(),
      target_role: data.targetRole,
      namespace_id: data.namespaceId,
      created_by: data.createdBy,
      created_at: now.toISOString(),
      expires_at: expiresAt.toISOString(),
    };

    const { data: row, error } = await supabase
      .from('invitations')
      .insert(insertData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create invitation: ${error.message}`);
    }

    return mapRowToInvitation(row as InvitationRow);
  }

  async getInvitation(id: string): Promise<Invitation | null> {
    const supabase = getClient(this.accessToken);

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get invitation: ${error.message}`);
    }

    return data ? mapRowToInvitation(data as InvitationRow) : null;
  }

  async getInvitationBySupabaseUserId(supabaseUserId: string): Promise<Invitation | null> {
    const supabase = getClient(this.accessToken);

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('supabase_user_id', supabaseUserId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get invitation by Supabase user ID: ${error.message}`);
    }

    return data ? mapRowToInvitation(data as InvitationRow) : null;
  }

  async getPendingInvitationByEmail(email: string, namespaceId: string): Promise<Invitation | null> {
    const supabase = getClient(this.accessToken);

    const { data, error } = await supabase
      .from('invitations')
      .select('*')
      .eq('email', email.toLowerCase().trim())
      .eq('namespace_id', namespaceId)
      .is('consumed_at', null)
      .is('revoked_at', null)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get pending invitation by email: ${error.message}`);
    }

    if (!data) return null;

    const invitation = mapRowToInvitation(data as InvitationRow);

    // Also check if expired
    if (getInvitationStatus(invitation) === 'expired') {
      return null;
    }

    return invitation;
  }

  async listInvitations(filters?: InvitationFilters): Promise<Invitation[]> {
    const supabase = getClient(this.accessToken);

    let query = supabase.from('invitations').select('*');

    if (filters?.namespaceId) {
      query = query.eq('namespace_id', filters.namespaceId);
    }

    if (filters?.targetRole) {
      query = query.eq('target_role', filters.targetRole);
    }

    if (filters?.email) {
      query = query.ilike('email', `%${filters.email}%`);
    }

    // Handle status filtering
    if (filters?.status) {
      const now = new Date().toISOString();
      switch (filters.status) {
        case 'pending':
          query = query
            .is('consumed_at', null)
            .is('revoked_at', null)
            .gt('expires_at', now);
          break;
        case 'consumed':
          query = query.not('consumed_at', 'is', null);
          break;
        case 'revoked':
          query = query.not('revoked_at', 'is', null);
          break;
        case 'expired':
          query = query
            .is('consumed_at', null)
            .is('revoked_at', null)
            .lte('expires_at', now);
          break;
      }
    }

    // Order by most recent first
    query = query.order('created_at', { ascending: false });

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to list invitations: ${error.message}`);
    }

    return (data as InvitationRow[]).map(mapRowToInvitation);
  }

  async updateInvitation(id: string, data: Partial<Invitation>): Promise<Invitation> {
    const supabase = getClient(this.accessToken);

    // Map domain fields to database columns
    const updateData: Record<string, string | null> = {};

    if (data.supabaseUserId !== undefined) {
      updateData.supabase_user_id = data.supabaseUserId ?? null;
    }
    if (data.consumedAt !== undefined) {
      updateData.consumed_at = data.consumedAt?.toISOString() ?? null;
    }
    if (data.consumedBy !== undefined) {
      updateData.consumed_by = data.consumedBy ?? null;
    }
    if (data.revokedAt !== undefined) {
      updateData.revoked_at = data.revokedAt?.toISOString() ?? null;
    }
    if (data.expiresAt !== undefined) {
      updateData.expires_at = data.expiresAt.toISOString();
    }

    const { data: row, error } = await supabase
      .from('invitations')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        throw new InvitationError(`Invitation not found: ${id}`, 'INVITATION_NOT_FOUND');
      }
      throw new Error(`Failed to update invitation: ${error.message}`);
    }

    return mapRowToInvitation(row as InvitationRow);
  }

  async consumeInvitation(id: string, userId: string): Promise<Invitation> {
    const invitation = await this.getInvitation(id);

    if (!invitation) {
      throw new InvitationError(`Invitation not found: ${id}`, 'INVITATION_NOT_FOUND');
    }

    const status = getInvitationStatus(invitation);

    if (status === 'consumed') {
      throw new InvitationError('Invitation has already been consumed', 'INVITATION_CONSUMED');
    }

    if (status === 'revoked') {
      throw new InvitationError('Invitation has been revoked', 'INVITATION_REVOKED');
    }

    if (status === 'expired') {
      throw new InvitationError('Invitation has expired', 'INVITATION_EXPIRED');
    }

    return this.updateInvitation(id, {
      consumedAt: new Date(),
      consumedBy: userId,
    });
  }

  async revokeInvitation(id: string): Promise<Invitation> {
    const invitation = await this.getInvitation(id);

    if (!invitation) {
      throw new InvitationError(`Invitation not found: ${id}`, 'INVITATION_NOT_FOUND');
    }

    const status = getInvitationStatus(invitation);

    if (status === 'consumed') {
      throw new InvitationError('Cannot revoke a consumed invitation', 'INVITATION_CONSUMED');
    }

    if (status === 'revoked') {
      // Idempotent - already revoked
      return invitation;
    }

    return this.updateInvitation(id, {
      revokedAt: new Date(),
    });
  }

  async countPendingInvitations(
    namespaceId: string,
    targetRole: 'namespace-admin' | 'instructor'
  ): Promise<number> {
    const supabase = getClient(this.accessToken);
    const now = new Date().toISOString();

    const { count, error } = await supabase
      .from('invitations')
      .select('*', { count: 'exact', head: true })
      .eq('namespace_id', namespaceId)
      .eq('target_role', targetRole)
      .is('consumed_at', null)
      .is('revoked_at', null)
      .gt('expires_at', now);

    if (error) {
      throw new Error(`Failed to count pending invitations: ${error.message}`);
    }

    return count ?? 0;
  }
}
