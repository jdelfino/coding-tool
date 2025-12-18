/**
 * Interfaces for authentication and authorization services.
 * These interfaces define contracts that can be implemented by different
 * auth providers (local, Auth0, Cognito, etc.) for easy swapping.
 */

import { User, UserRole, AuthToken } from './types';

/**
 * Authentication provider interface.
 * Implementations handle user authentication via different methods
 * (password-less email, OAuth, etc.).
 */
export interface IAuthProvider {
  /**
   * Send authentication email to the user.
   * For password-less auth, this sends a magic link or one-time code.
   * 
   * @param email - User's email address
   * @throws {Error} If email sending fails
   */
  sendAuthEmail(email: string): Promise<void>;

  /**
   * Verify an authentication token and return the associated user.
   * Returns null if the token is invalid or expired.
   * 
   * @param token - Authentication token to verify
   * @returns User if token is valid, null otherwise
   */
  verifyAuthToken(token: string): Promise<User | null>;

  /**
   * Create a new user account.
   * 
   * @param email - User's email address
   * @param role - User's role (instructor or student)
   * @returns The newly created user
   * @throws {Error} If user already exists or creation fails
   */
  createUser(email: string, role: UserRole): Promise<User>;

  /**
   * Get a user by their ID.
   * 
   * @param userId - User's unique identifier
   * @returns User if found, null otherwise
   */
  getUser(userId: string): Promise<User | null>;

  /**
   * Get a user by their email address.
   * 
   * @param email - User's email address
   * @returns User if found, null otherwise
   */
  getUserByEmail(email: string): Promise<User | null>;

  /**
   * Update user information.
   * 
   * @param userId - User's unique identifier
   * @param updates - Partial user object with fields to update
   * @throws {Error} If user not found or update fails
   */
  updateUser(userId: string, updates: Partial<User>): Promise<void>;

  /**
   * Delete a user account.
   * 
   * @param userId - User's unique identifier
   * @throws {Error} If user not found or deletion fails
   */
  deleteUser(userId: string): Promise<void>;
}

/**
 * User repository interface for data persistence.
 * Separates data storage from authentication logic.
 */
export interface IUserRepository {
  /**
   * Save a user to storage.
   * Creates new user if not exists, updates if exists.
   * 
   * @param user - User to save
   */
  saveUser(user: User): Promise<void>;

  /**
   * Get a user by their ID.
   * 
   * @param userId - User's unique identifier
   * @returns User if found, null otherwise
   */
  getUser(userId: string): Promise<User | null>;

  /**
   * Get a user by their email address.
   * 
   * @param email - User's email address
   * @returns User if found, null otherwise
   */
  getUserByEmail(email: string): Promise<User | null>;

  /**
   * List all users, optionally filtered by role.
   * 
   * @param role - Optional role filter
   * @returns Array of users
   */
  listUsers(role?: UserRole): Promise<User[]>;

  /**
   * Update user information.
   * 
   * @param userId - User's unique identifier
   * @param updates - Partial user object with fields to update
   * @throws {Error} If user not found
   */
  updateUser(userId: string, updates: Partial<User>): Promise<void>;

  /**
   * Delete a user from storage.
   * 
   * @param userId - User's unique identifier
   * @throws {Error} If user not found
   */
  deleteUser(userId: string): Promise<void>;
}

/**
 * Role-Based Access Control (RBAC) service interface.
 * Handles authorization and permission checking.
 */
export interface IRBACService {
  /**
   * Check if a user has a specific permission.
   * 
   * @param user - User to check
   * @param permission - Permission string (e.g., 'session.create')
   * @returns True if user has permission, false otherwise
   */
  hasPermission(user: User, permission: string): boolean;

  /**
   * Check if a user can access a specific coding session.
   * Instructors can access all sessions.
   * Students can only access sessions they're enrolled in.
   * 
   * @param user - User to check
   * @param sessionId - Session ID to check access for
   * @returns True if user can access session, false otherwise
   */
  canAccessSession(user: User, sessionId: string): Promise<boolean>;

  /**
   * Check if a user can manage (modify/delete) another user.
   * Typically, only instructors can manage users.
   * 
   * @param actor - User attempting the action
   * @param target - User being managed
   * @returns True if actor can manage target, false otherwise
   */
  canManageUser(actor: User, target: User): boolean;

  /**
   * Get all permissions for a given role.
   * 
   * @param role - User role
   * @returns Array of permission strings
   */
  getRolePermissions(role: UserRole): string[];
}

/**
 * Token management interface.
 * Handles creation and validation of authentication tokens.
 */
export interface ITokenManager {
  /**
   * Generate a new authentication token for an email.
   * 
   * @param email - Email address to associate with token
   * @returns Token information including expiration
   */
  generateToken(email: string): Promise<AuthToken>;

  /**
   * Validate a token and return the associated email.
   * 
   * @param token - Token string to validate
   * @returns Email if token is valid, null otherwise
   */
  validateToken(token: string): Promise<string | null>;

  /**
   * Revoke/invalidate a token.
   * 
   * @param token - Token to revoke
   */
  revokeToken(token: string): Promise<void>;
}

/**
 * Email service interface for sending authentication emails.
 */
export interface IEmailService {
  /**
   * Send an authentication email with a magic link or code.
   * 
   * @param email - Recipient email address
   * @param token - Authentication token to include in email
   * @throws {Error} If email sending fails
   */
  sendAuthEmail(email: string, token: string): Promise<void>;

  /**
   * Send a welcome email to a new user.
   * 
   * @param user - New user to welcome
   */
  sendWelcomeEmail(user: User): Promise<void>;
}
