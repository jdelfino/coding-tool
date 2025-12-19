/**
 * Persistence layer interface definitions
 * 
 * This file defines the contracts for all data persistence operations.
 * These interfaces can be implemented by different storage backends
 * (local files, remote API, in-memory, database, etc.) without requiring
 * changes to the calling code.
 * 
 * Design principles:
 * - All methods return Promises for async compatibility
 * - Use null for not-found (don't throw unless error)
 * - Throw PersistenceError for actual errors
 * - Accept Partial<T> for updates to allow selective updates
 */

import { Session, Student } from '../types';
import { IUserRepository } from '../auth/interfaces';
import {
  ProblemSpec,
  CodeRevision,
  StorageConfig,
  SessionQueryOptions,
  StoredSession,
  StoredProblem,
  StoredRevision,
} from './types';

// Re-export IUserRepository for convenience
export type { IUserRepository };

/**
 * Base interface for all storage backends
 * 
 * Provides lifecycle management and health checking for storage systems.
 */
export interface IStorageBackend {
  /**
   * Initialize the storage backend
   * 
   * Should establish connections, create directories, verify credentials, etc.
   * Must be called before using the storage backend.
   * 
   * @throws {PersistenceError} if initialization fails
   */
  initialize(): Promise<void>;

  /**
   * Shutdown the storage backend gracefully
   * 
   * Should close connections, flush buffers, clean up resources.
   * After shutdown, the backend should not be used.
   */
  shutdown(): Promise<void>;

  /**
   * Check if the storage backend is healthy and available
   * 
   * @returns true if storage is accessible and operational
   */
  health(): Promise<boolean>;
}

/**
 * Repository interface for session data operations
 * 
 * Manages CRUD operations for coding sessions, including active and
 * historical sessions.
 */
export interface ISessionRepository extends IStorageBackend {
  /**
   * Create a new session
   * 
   * @param session - Session data to store
   * @returns The session ID
   * @throws {PersistenceError} with ALREADY_EXISTS if session ID exists
   */
  createSession(session: Session): Promise<string>;

  /**
   * Retrieve a session by ID
   * 
   * @param sessionId - Unique session identifier
   * @returns The session data, or null if not found
   */
  getSession(sessionId: string): Promise<StoredSession | null>;

  /**
   * Update an existing session
   * 
   * Performs a partial update - only provided fields are modified.
   * 
   * @param sessionId - Session to update
   * @param updates - Partial session data to update
   * @throws {PersistenceError} with NOT_FOUND if session doesn't exist
   */
  updateSession(sessionId: string, updates: Partial<Session>): Promise<void>;

  /**
   * Delete a session
   * 
   * Removes the session and optionally all related data (revisions, etc).
   * 
   * @param sessionId - Session to delete
   * @throws {PersistenceError} with NOT_FOUND if session doesn't exist
   */
  deleteSession(sessionId: string): Promise<void>;

  /**
   * List all currently active sessions
   * 
   * @returns Array of active sessions (where active flag is true)
   */
  listActiveSessions(): Promise<StoredSession[]>;

  /**
   * List all sessions with optional filtering and pagination
   * 
   * @param options - Query options for filtering and pagination
   * @returns Array of sessions matching the query
   */
  listAllSessions(options?: SessionQueryOptions): Promise<StoredSession[]>;

  /**
   * Get a session by join code
   * 
   * @param joinCode - The join code to search for
   * @returns The session with this join code, or null if not found
   */
  getSessionByJoinCode(joinCode: string): Promise<StoredSession | null>;

  /**
   * Count total sessions (optionally filtered)
   * 
   * @param options - Query options for filtering
   * @returns Total number of sessions matching the query
   */
  countSessions(options?: SessionQueryOptions): Promise<number>;
}

/**
 * Repository interface for problem specifications
 * 
 * Manages problem definitions, templates, and metadata.
 */
export interface IProblemRepository extends IStorageBackend {
  /**
   * Save a problem specification
   * 
   * If a problem with the same ID exists, it will be updated.
   * 
   * @param problem - Problem data to store
   * @returns The problem ID
   */
  saveProblem(problem: ProblemSpec): Promise<string>;

  /**
   * Retrieve a problem by ID
   * 
   * @param problemId - Unique problem identifier
   * @returns The problem data, or null if not found
   */
  getProblem(problemId: string): Promise<StoredProblem | null>;

  /**
   * Update an existing problem
   * 
   * @param problemId - Problem to update
   * @param updates - Partial problem data to update
   * @throws {PersistenceError} with NOT_FOUND if problem doesn't exist
   */
  updateProblem(problemId: string, updates: Partial<ProblemSpec>): Promise<void>;

  /**
   * Delete a problem
   * 
   * @param problemId - Problem to delete
   * @throws {PersistenceError} with NOT_FOUND if problem doesn't exist
   */
  deleteProblem(problemId: string): Promise<void>;

  /**
   * List all problems with optional filtering
   * 
   * @param filters - Optional filters (difficulty, tags, etc.)
   * @returns Array of problems
   */
  listProblems(filters?: {
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    tags?: string[];
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<StoredProblem[]>;

  /**
   * Search problems by title or description
   * 
   * @param query - Search query string
   * @param limit - Maximum results to return
   * @returns Array of matching problems
   */
  searchProblems(query: string, limit?: number): Promise<StoredProblem[]>;
}

/**
 * Repository interface for code revision history
 * 
 * Manages student code snapshots and revision tracking.
 */
export interface IRevisionRepository extends IStorageBackend {
  /**
   * Save a code revision
   * 
   * Appends a new revision to the student's history for this session.
   * 
   * @param revision - Revision data to store
   * @returns The revision ID
   */
  saveRevision(revision: CodeRevision): Promise<string>;

  /**
   * Get all revisions for a student in a session
   * 
   * Revisions are returned in chronological order (oldest first).
   * 
   * @param sessionId - Session identifier
   * @param studentId - Student identifier
   * @returns Array of revisions
   */
  getRevisions(sessionId: string, studentId: string): Promise<StoredRevision[]>;

  /**
   * Get a specific revision by ID
   * 
   * @param revisionId - Unique revision identifier
   * @returns The revision data, or null if not found
   */
  getRevision(revisionId: string): Promise<StoredRevision | null>;

  /**
   * Get the latest revision for a student in a session
   * 
   * @param sessionId - Session identifier
   * @param studentId - Student identifier
   * @returns The most recent revision, or null if no revisions exist
   */
  getLatestRevision(sessionId: string, studentId: string): Promise<StoredRevision | null>;

  /**
   * Delete all revisions for a student in a session
   * 
   * If studentId is not provided, deletes all revisions for the session.
   * 
   * @param sessionId - Session identifier
   * @param studentId - Optional student identifier
   */
  deleteRevisions(sessionId: string, studentId?: string): Promise<void>;

  /**
   * Count revisions for a student in a session
   * 
   * @param sessionId - Session identifier
   * @param studentId - Student identifier
   * @returns Total number of revisions
   */
  countRevisions(sessionId: string, studentId: string): Promise<number>;

  /**
   * Get revision history for all students in a session
   * 
   * Useful for instructor overview of all student work.
   * 
   * @param sessionId - Session identifier
   * @returns Map of studentId to array of revisions
   */
  getAllSessionRevisions(sessionId: string): Promise<Map<string, StoredRevision[]>>;
}

/**
 * Composite repository interface
 * 
 * Combines all repositories into a single interface for convenience.
 * Implementations can provide all repositories from a single backend.
 */
export interface IStorageRepository extends IStorageBackend {
  /** Session data operations */
  sessions: ISessionRepository;
  
  /** Problem data operations */
  problems: IProblemRepository;
  
  /** Revision data operations */
  revisions: IRevisionRepository;
  
  /** User data operations */
  users: IUserRepository;

  /** Class data operations (multi-tenancy) */
  classes?: import('../classes/interfaces').IClassRepository;

  /** Section data operations (multi-tenancy) */
  sections?: import('../classes/interfaces').ISectionRepository;

  /** Section membership operations (multi-tenancy) */
  memberships?: import('../classes/interfaces').IMembershipRepository;
}
