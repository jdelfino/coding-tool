/**
 * Supabase-backed revision repository implementation
 *
 * Implements code revision operations using Supabase as the storage backend.
 * Revisions track student code changes during coding sessions.
 *
 * Supports RLS-backed access control when accessToken is provided.
 */

import { v4 as uuidv4 } from 'uuid';
import { IRevisionRepository } from '../interfaces';
import { CodeRevision, StoredRevision, StorageMetadata } from '../types';
import { getClient, RevisionRow } from '../../supabase/client';

/**
 * Maps a database row to a StoredRevision domain object
 */
function mapRowToRevision(row: RevisionRow): StoredRevision {
  // Parse execution_result from JSONB
  let executionResult: StoredRevision['executionResult'] | undefined;
  if (row.execution_result) {
    const result = row.execution_result as {
      success?: boolean;
      output?: string;
      error?: string;
    };
    executionResult = {
      success: result.success ?? false,
      output: result.output ?? '',
      error: result.error ?? '',
    };
  }

  const revision: StoredRevision = {
    id: row.id,
    namespaceId: row.namespace_id,
    sessionId: row.session_id,
    studentId: row.student_id,
    timestamp: new Date(row.timestamp),
    isDiff: row.is_diff,
    diff: row.diff || undefined,
    fullCode: row.full_code || undefined,
    baseRevisionId: row.base_revision_id || undefined,
    executionResult,
    _metadata: {
      createdAt: new Date(row.timestamp),
      updatedAt: new Date(row.timestamp),
      version: 1,
    },
  };

  return revision;
}

/**
 * Supabase implementation of IRevisionRepository
 */
export class SupabaseRevisionRepository implements IRevisionRepository {
  private initialized = false;
  private readonly accessToken?: string;

  constructor(accessToken?: string) {
    this.accessToken = accessToken;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection
    const supabase = getClient(this.accessToken);
    const { error } = await supabase.from('revisions').select('id').limit(1);

    if (error) {
      throw new Error(`Failed to initialize RevisionRepository: ${error.message}`);
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for Supabase client
    this.initialized = false;
  }

  async health(): Promise<boolean> {
    try {
      const supabase = getClient(this.accessToken);
      const { error } = await supabase.from('revisions').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async saveRevision(revision: CodeRevision): Promise<string> {
    const supabase = getClient(this.accessToken);

    // Generate ID if not provided
    const id = revision.id || uuidv4();

    // Prepare revision data for database
    const revisionData = {
      id,
      namespace_id: revision.namespaceId,
      session_id: revision.sessionId,
      student_id: revision.studentId,
      timestamp: revision.timestamp.toISOString(),
      is_diff: revision.isDiff,
      diff: revision.diff || null,
      full_code: revision.fullCode || null,
      base_revision_id: revision.baseRevisionId || null,
      execution_result: revision.executionResult
        ? {
            success: revision.executionResult.success,
            output: revision.executionResult.output,
            error: revision.executionResult.error,
          }
        : null,
    };

    const { error } = await supabase.from('revisions').insert(revisionData);

    if (error) {
      throw new Error(`Failed to save revision: ${error.message}`);
    }

    return id;
  }

  async getRevisions(
    sessionId: string,
    studentId: string,
    namespaceId?: string
  ): Promise<StoredRevision[]> {
    const supabase = getClient(this.accessToken);

    let query = supabase
      .from('revisions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .order('timestamp', { ascending: true });

    // Apply namespace filter if provided
    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get revisions: ${error.message}`);
    }

    return data ? data.map(mapRowToRevision) : [];
  }

  async getRevision(revisionId: string): Promise<StoredRevision | null> {
    const supabase = getClient(this.accessToken);

    const { data, error } = await supabase
      .from('revisions')
      .select('*')
      .eq('id', revisionId)
      .single();

    if (error) {
      // Not found is expected, other errors are not
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get revision: ${error.message}`);
    }

    return data ? mapRowToRevision(data) : null;
  }

  async getLatestRevision(
    sessionId: string,
    studentId: string
  ): Promise<StoredRevision | null> {
    const supabase = getClient(this.accessToken);

    const { data, error } = await supabase
      .from('revisions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .order('timestamp', { ascending: false })
      .limit(1)
      .single();

    if (error) {
      // Not found is expected (no revisions yet)
      if (error.code === 'PGRST116') {
        return null;
      }
      throw new Error(`Failed to get latest revision: ${error.message}`);
    }

    return data ? mapRowToRevision(data) : null;
  }

  async deleteRevisions(sessionId: string, studentId?: string): Promise<void> {
    const supabase = getClient(this.accessToken);

    let query = supabase.from('revisions').delete().eq('session_id', sessionId);

    // If studentId is provided, only delete that student's revisions
    if (studentId) {
      query = query.eq('student_id', studentId);
    }

    const { error } = await query;

    if (error) {
      throw new Error(`Failed to delete revisions: ${error.message}`);
    }
  }

  async countRevisions(sessionId: string, studentId: string): Promise<number> {
    const supabase = getClient(this.accessToken);

    const { count, error } = await supabase
      .from('revisions')
      .select('*', { count: 'exact', head: true })
      .eq('session_id', sessionId)
      .eq('student_id', studentId);

    if (error) {
      throw new Error(`Failed to count revisions: ${error.message}`);
    }

    return count ?? 0;
  }

  async getAllSessionRevisions(
    sessionId: string,
    namespaceId?: string
  ): Promise<Map<string, StoredRevision[]>> {
    const supabase = getClient(this.accessToken);

    let query = supabase
      .from('revisions')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: true });

    // Apply namespace filter if provided
    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(`Failed to get all session revisions: ${error.message}`);
    }

    // Group revisions by student_id
    const result = new Map<string, StoredRevision[]>();

    if (data) {
      for (const row of data) {
        const revision = mapRowToRevision(row);
        const studentId = revision.studentId;

        if (!result.has(studentId)) {
          result.set(studentId, []);
        }
        result.get(studentId)!.push(revision);
      }
    }

    return result;
  }
}
