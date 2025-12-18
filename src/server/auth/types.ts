/**
 * Core authentication and authorization types for the coding tool.
 * These types define the data structures used across all auth providers.
 */

/**
 * User roles in the system.
 * - instructor: Full access to create sessions, view all data, manage users
 * - student: Limited access to join sessions and view own code only
 */
export type UserRole = 'instructor' | 'student';

/**
 * Granular permissions for fine-grained access control.
 * Permission strings follow the pattern: resource.action
 */
export type Permission =
  // Session permissions
  | 'session.create'
  | 'session.join'
  | 'session.viewAll'
  | 'session.viewOwn'
  | 'session.delete'
  // User management permissions
  | 'user.manage'
  | 'user.create'
  | 'user.delete'
  | 'user.viewAll'
  // Data access permissions
  | 'data.viewAll'
  | 'data.viewOwn'
  | 'data.export';

/**
 * Represents a user account in the system.
 */
export interface User {
  /** Unique identifier for the user */
  id: string;
  /** Username for authentication */
  username: string;
  /** User's role determining their permissions */
  role: UserRole;
  /** Optional display name for the user */
  displayName?: string;
  /** When the user account was created */
  createdAt: Date;
  /** Last time the user logged in */
  lastLoginAt?: Date;
}

/**
 * Active authentication session for a client.
 */
export interface AuthSession {
  /** The authenticated user */
  user: User;
  /** Session identifier */
  sessionId: string;
  /** When this session was created */
  createdAt: Date;
}

/**
 * Request payload for user login.
 */
export interface LoginRequest {
  /** Username for authentication */
  username: string;
}

/**
 * Response after successful authentication.
 */
export interface LoginResponse {
  /** The authenticated user */
  user: User;
  /** Session identifier */
  sessionId: string;
}

/**
 * User with their associated coding sessions.
 * Used for displaying user session history.
 */
export interface UserWithSessions {
  /** The user information */
  user: User;
  /** IDs of coding sessions the user participated in */
  sessionIds: string[];
  /** Count of total sessions */
  sessionCount: number;
}

/**
 * Error thrown when authentication fails.
 */
export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

/**
 * Error thrown when authorization fails (user lacks permission).
 */
export class AuthorizationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthorizationError';
  }
}
