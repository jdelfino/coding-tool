/**
 * Supabase-backed session repository implementation
 *
 * Implements session CRUD operations using Supabase as the storage backend.
 * Sessions are stored in the sessions table with students stored in session_students.
 * This is the most complex repository as it manages session state with multiple students.
 *
 * Supports RLS-backed access control when accessToken is provided.
 */

import { Session, Student } from '../../types';
import { Problem, ExecutionSettings } from '../../types/problem';
import { ISessionRepository } from '../interfaces';
import {
  SessionQueryOptions,
  StoredSession,
  PersistenceError,
  PersistenceErrorCode,
} from '../types';
import { getSupabaseClientWithAuth, SessionRow, SessionStudentRow } from '../../supabase/client';

/**
 * Maps database session and student rows to a StoredSession domain object
 */
function mapRowsToSession(
  sessionRow: SessionRow,
  studentRows: SessionStudentRow[]
): StoredSession {
  // Reconstruct the students Map from student rows (keyed by user_id)
  const students = new Map<string, Student>();
  for (const studentRow of studentRows) {
    students.set(studentRow.user_id, {
      userId: studentRow.user_id,
      name: studentRow.name,
      code: studentRow.code,
      lastUpdate: new Date(studentRow.last_update),
      executionSettings: studentRow.execution_settings as ExecutionSettings | undefined,
      // ws is not persisted - it's a runtime-only WebSocket connection
    });
  }

  // Parse problem from JSONB
  const problem = sessionRow.problem as unknown as Problem;

  return {
    id: sessionRow.id,
    namespaceId: sessionRow.namespace_id,
    sectionId: sessionRow.section_id,
    sectionName: sessionRow.section_name,
    problem,
    students,
    featuredStudentId: sessionRow.featured_student_id || undefined,
    featuredCode: sessionRow.featured_code || undefined,
    createdAt: new Date(sessionRow.created_at),
    lastActivity: new Date(sessionRow.last_activity),
    creatorId: sessionRow.creator_id,
    participants: sessionRow.participants,
    status: sessionRow.status as 'active' | 'completed',
    endedAt: sessionRow.ended_at ? new Date(sessionRow.ended_at) : undefined,
    // WebSocket connections are not persisted
    instructorWs: undefined,
    publicViewWs: undefined,
  };
}

/**
 * Supabase implementation of ISessionRepository
 */
export class SupabaseSessionRepository implements ISessionRepository {
  private initialized = false;
  private readonly accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    // Test connection
    const supabase = getSupabaseClientWithAuth(this.accessToken);
    const { error } = await supabase.from('sessions').select('id').limit(1);

    if (error) {
      throw new Error(`Failed to initialize SessionRepository: ${error.message}`);
    }

    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    // No cleanup needed for Supabase client
    this.initialized = false;
  }

  async health(): Promise<boolean> {
    try {
      const supabase = getSupabaseClientWithAuth(this.accessToken);
      const { error } = await supabase.from('sessions').select('id').limit(1);
      return !error;
    } catch {
      return false;
    }
  }

  async createSession(session: Session): Promise<string> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // Check if session already exists
    const { data: existing } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', session.id)
      .single();

    if (existing) {
      throw new PersistenceError(
        `Session already exists: ${session.id}`,
        PersistenceErrorCode.ALREADY_EXISTS
      );
    }

    // Prepare session data for database
    const sessionData = {
      id: session.id,
      namespace_id: session.namespaceId,
      section_id: session.sectionId,
      section_name: session.sectionName,
      problem: session.problem as any,
      featured_student_id: session.featuredStudentId || null,
      featured_code: session.featuredCode || null,
      created_at: session.createdAt.toISOString(),
      last_activity: session.lastActivity.toISOString(),
      creator_id: session.creatorId,
      participants: session.participants,
      status: session.status,
      ended_at: session.endedAt?.toISOString() || null,
    };

    // Insert session
    const { error: sessionError } = await supabase.from('sessions').insert(sessionData);

    if (sessionError) {
      throw new PersistenceError(
        `Failed to create session: ${sessionError.message}`,
        PersistenceErrorCode.STORAGE_ERROR,
        sessionError
      );
    }

    // Insert students if any
    if (session.students.size > 0) {
      const studentRows = Array.from(session.students.entries()).map(([userId, student]) => ({
        session_id: session.id,
        user_id: userId,
        name: student.name,
        code: student.code,
        last_update: student.lastUpdate.toISOString(),
        execution_settings: (student.executionSettings as any) || null,
      }));

      const { error: studentsError } = await supabase.from('session_students').insert(studentRows);

      if (studentsError) {
        // Attempt to rollback session creation
        await supabase.from('sessions').delete().eq('id', session.id);
        throw new PersistenceError(
          `Failed to create session students: ${studentsError.message}`,
          PersistenceErrorCode.STORAGE_ERROR,
          studentsError
        );
      }
    }

    return session.id;
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // Fetch session
    const { data: sessionRow, error: sessionError } = await supabase
      .from('sessions')
      .select('*')
      .eq('id', sessionId)
      .single();

    if (sessionError) {
      if (sessionError.code === 'PGRST116') {
        return null;
      }
      throw new PersistenceError(
        `Failed to get session: ${sessionError.message}`,
        PersistenceErrorCode.STORAGE_ERROR,
        sessionError
      );
    }

    if (!sessionRow) {
      return null;
    }

    // Fetch students for this session
    const { data: studentRows, error: studentsError } = await supabase
      .from('session_students')
      .select('*')
      .eq('session_id', sessionId);

    if (studentsError) {
      throw new PersistenceError(
        `Failed to get session students: ${studentsError.message}`,
        PersistenceErrorCode.STORAGE_ERROR,
        studentsError
      );
    }

    return mapRowsToSession(sessionRow, studentRows || []);
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // First check if session exists
    const { data: existing, error: existingError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (existingError && existingError.code === 'PGRST116') {
      throw new PersistenceError(
        `Session not found: ${sessionId}`,
        PersistenceErrorCode.NOT_FOUND
      );
    }

    if (!existing) {
      throw new PersistenceError(
        `Session not found: ${sessionId}`,
        PersistenceErrorCode.NOT_FOUND
      );
    }

    // Build update object for sessions table
    const sessionUpdates: Record<string, unknown> = {};

    if (updates.namespaceId !== undefined) sessionUpdates.namespace_id = updates.namespaceId;
    if (updates.sectionId !== undefined) sessionUpdates.section_id = updates.sectionId;
    if (updates.sectionName !== undefined) sessionUpdates.section_name = updates.sectionName;
    if (updates.problem !== undefined) sessionUpdates.problem = updates.problem as any;
    if (updates.featuredStudentId !== undefined) sessionUpdates.featured_student_id = updates.featuredStudentId || null;
    if (updates.featuredCode !== undefined) sessionUpdates.featured_code = updates.featuredCode || null;
    if (updates.lastActivity !== undefined) sessionUpdates.last_activity = updates.lastActivity.toISOString();
    if (updates.creatorId !== undefined) sessionUpdates.creator_id = updates.creatorId;
    if (updates.participants !== undefined) sessionUpdates.participants = updates.participants;
    if (updates.status !== undefined) sessionUpdates.status = updates.status;
    if (updates.endedAt !== undefined) sessionUpdates.ended_at = updates.endedAt?.toISOString() || null;

    // Update session if there are session-level changes
    if (Object.keys(sessionUpdates).length > 0) {
      const { error: updateError } = await supabase
        .from('sessions')
        .update(sessionUpdates)
        .eq('id', sessionId);

      if (updateError) {
        throw new PersistenceError(
          `Failed to update session: ${updateError.message}`,
          PersistenceErrorCode.STORAGE_ERROR,
          updateError
        );
      }
    }

    // Handle student updates if provided
    if (updates.students !== undefined && updates.students.size > 0) {
      // Use UPSERT to insert or update students (works with RLS since students have INSERT + UPDATE permissions)
      const studentRows = Array.from(updates.students.entries()).map(([userId, student]) => ({
        session_id: sessionId,
        user_id: userId,
        name: student.name,
        code: student.code,
        last_update: student.lastUpdate.toISOString(),
        execution_settings: (student.executionSettings as any) || null,
      }));

      const { error: upsertError } = await supabase
        .from('session_students')
        .upsert(studentRows, {
          onConflict: 'session_id,user_id',
        });

      if (upsertError) {
        throw new PersistenceError(
          `Failed to update session students: ${upsertError.message}`,
          PersistenceErrorCode.STORAGE_ERROR,
          upsertError
        );
      }
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    // First check if session exists
    const { data: existing, error: existingError } = await supabase
      .from('sessions')
      .select('id')
      .eq('id', sessionId)
      .single();

    if (existingError && existingError.code === 'PGRST116') {
      throw new PersistenceError(
        `Session not found: ${sessionId}`,
        PersistenceErrorCode.NOT_FOUND
      );
    }

    if (!existing) {
      throw new PersistenceError(
        `Session not found: ${sessionId}`,
        PersistenceErrorCode.NOT_FOUND
      );
    }

    // Delete students first (foreign key constraint)
    const { error: studentsDeleteError } = await supabase
      .from('session_students')
      .delete()
      .eq('session_id', sessionId);

    if (studentsDeleteError) {
      throw new PersistenceError(
        `Failed to delete session students: ${studentsDeleteError.message}`,
        PersistenceErrorCode.STORAGE_ERROR,
        studentsDeleteError
      );
    }

    // Delete session
    const { error: sessionDeleteError } = await supabase
      .from('sessions')
      .delete()
      .eq('id', sessionId);

    if (sessionDeleteError) {
      throw new PersistenceError(
        `Failed to delete session: ${sessionDeleteError.message}`,
        PersistenceErrorCode.STORAGE_ERROR,
        sessionDeleteError
      );
    }
  }

  async listActiveSessions(namespaceId?: string): Promise<StoredSession[]> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    let query = supabase.from('sessions').select('*').eq('status', 'active');

    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    }

    const { data: sessionRows, error } = await query;

    if (error) {
      throw new PersistenceError(
        `Failed to list active sessions: ${error.message}`,
        PersistenceErrorCode.STORAGE_ERROR,
        error
      );
    }

    if (!sessionRows || sessionRows.length === 0) {
      return [];
    }

    // Fetch all students for these sessions
    const sessionIds = sessionRows.map((s) => s.id);
    const { data: studentRows, error: studentsError } = await supabase
      .from('session_students')
      .select('*')
      .in('session_id', sessionIds);

    if (studentsError) {
      throw new PersistenceError(
        `Failed to list session students: ${studentsError.message}`,
        PersistenceErrorCode.STORAGE_ERROR,
        studentsError
      );
    }

    // Group students by session ID
    const studentsBySession = new Map<string, SessionStudentRow[]>();
    for (const studentRow of studentRows || []) {
      const existing = studentsBySession.get(studentRow.session_id) || [];
      existing.push(studentRow);
      studentsBySession.set(studentRow.session_id, existing);
    }

    // Map to StoredSessions
    return sessionRows.map((sessionRow) =>
      mapRowsToSession(sessionRow, studentsBySession.get(sessionRow.id) || [])
    );
  }

  async listAllSessions(
    options?: SessionQueryOptions,
    namespaceId?: string
  ): Promise<StoredSession[]> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    let query = supabase.from('sessions').select('*');

    // Apply namespace filter
    if (namespaceId) {
      query = query.eq('namespace_id', namespaceId);
    } else if (options?.namespaceId) {
      query = query.eq('namespace_id', options.namespaceId);
    }

    // Apply active filter
    if (options?.active !== undefined) {
      query = query.eq('status', options.active ? 'active' : 'completed');
    }

    // Apply instructor filter
    if (options?.instructorId) {
      query = query.eq('creator_id', options.instructorId);
    }

    // Apply section filter
    if (options?.sectionId) {
      query = query.eq('section_id', options.sectionId);
    }

    // Apply sorting
    if (options?.sortBy) {
      const columnMap: Record<string, string> = {
        createdAt: 'created_at',
        lastActivity: 'last_activity',
        joinCode: 'id', // sessions don't have join_code, use id as fallback
      };
      const column = columnMap[options.sortBy] || 'created_at';
      query = query.order(column, { ascending: options.sortOrder === 'asc' });
    } else {
      // Default sort by created_at desc
      query = query.order('created_at', { ascending: false });
    }

    // Apply pagination
    if (options?.offset !== undefined) {
      query = query.range(options.offset, options.offset + (options.limit || 50) - 1);
    } else if (options?.limit !== undefined) {
      query = query.limit(options.limit);
    }

    const { data: sessionRows, error } = await query;

    if (error) {
      throw new PersistenceError(
        `Failed to list sessions: ${error.message}`,
        PersistenceErrorCode.STORAGE_ERROR,
        error
      );
    }

    if (!sessionRows || sessionRows.length === 0) {
      return [];
    }

    // Fetch all students for these sessions
    const sessionIds = sessionRows.map((s) => s.id);
    const { data: studentRows, error: studentsError } = await supabase
      .from('session_students')
      .select('*')
      .in('session_id', sessionIds);

    if (studentsError) {
      throw new PersistenceError(
        `Failed to list session students: ${studentsError.message}`,
        PersistenceErrorCode.STORAGE_ERROR,
        studentsError
      );
    }

    // Group students by session ID
    const studentsBySession = new Map<string, SessionStudentRow[]>();
    for (const studentRow of studentRows || []) {
      const existing = studentsBySession.get(studentRow.session_id) || [];
      existing.push(studentRow);
      studentsBySession.set(studentRow.session_id, existing);
    }

    // Map to StoredSessions
    return sessionRows.map((sessionRow) =>
      mapRowsToSession(sessionRow, studentsBySession.get(sessionRow.id) || [])
    );
  }

  async countSessions(options?: SessionQueryOptions): Promise<number> {
    const supabase = getSupabaseClientWithAuth(this.accessToken);

    let query = supabase.from('sessions').select('id', { count: 'exact', head: true });

    // Apply namespace filter
    if (options?.namespaceId) {
      query = query.eq('namespace_id', options.namespaceId);
    }

    // Apply active filter
    if (options?.active !== undefined) {
      query = query.eq('status', options.active ? 'active' : 'completed');
    }

    // Apply instructor filter
    if (options?.instructorId) {
      query = query.eq('creator_id', options.instructorId);
    }

    const { count, error } = await query;

    if (error) {
      throw new PersistenceError(
        `Failed to count sessions: ${error.message}`,
        PersistenceErrorCode.STORAGE_ERROR,
        error
      );
    }

    return count || 0;
  }
}
