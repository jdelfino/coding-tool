/**
 * Local authentication provider implementation.
 * Implements simple username-based authentication with auto-account creation.
 */

import { User, UserRole, AuthenticationError, AuthSession } from './types';
import { IAuthProvider, IUserRepository } from './interfaces';
import { randomUUID } from 'crypto';

/**
 * Local authentication provider using simple username-based login.
 * Features:
 * - Auto-creates users on first login
 * - First user becomes instructor, subsequent users are students
 * - No password required (trust-based for local development)
 */
export class LocalAuthProvider implements IAuthProvider {
  private userRepository: IUserRepository;
  private activeSessions: Map<string, AuthSession> = new Map();

  constructor(userRepository: IUserRepository) {
    this.userRepository = userRepository;
  }

  /**
   * Authenticate a user with their username.
   * Auto-creates user if they don't exist.
   * First user becomes instructor, subsequent users are students.
   */
  async authenticate(username: string): Promise<User | null> {
    if (!username || username.trim().length === 0) {
      throw new AuthenticationError('Username is required');
    }

    const normalizedUsername = username.trim();

    // Check if user already exists
    let user = await this.userRepository.getUserByUsername(normalizedUsername);

    if (!user) {
      // Auto-create user
      const userCount = await (this.userRepository as any).getUserCount?.() || 0;
      const role: UserRole = userCount === 0 ? 'instructor' : 'student';
      
      user = await this.createUser(normalizedUsername, role);
      console.log(`[Auth] Created new ${role} account: ${normalizedUsername}`);
    } else {
      // Update last login time
      await this.userRepository.updateUser(user.id, {
        lastLoginAt: new Date(),
      });
      
      // Refresh user object
      user = await this.userRepository.getUser(user.id) as User;
      console.log(`[Auth] User logged in: ${normalizedUsername} (${user.role})`);
    }

    return user;
  }

  /**
   * Create a new user account.
   */
  async createUser(username: string, role: UserRole): Promise<User> {
    // Check if username already taken
    const existingUser = await this.userRepository.getUserByUsername(username);
    if (existingUser) {
      throw new AuthenticationError(`Username already taken: ${username}`);
    }

    const user: User = {
      id: randomUUID(),
      username: username.trim(),
      role,
      createdAt: new Date(),
      lastLoginAt: new Date(),
    };

    await this.userRepository.saveUser(user);
    return user;
  }

  /**
   * Get a user by their ID.
   */
  async getUser(userId: string): Promise<User | null> {
    return this.userRepository.getUser(userId);
  }

  /**
   * Get a user by their username.
   */
  async getUserByUsername(username: string): Promise<User | null> {
    return this.userRepository.getUserByUsername(username);
  }

  /**
   * Update user information.
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    await this.userRepository.updateUser(userId, updates);
  }

  /**
   * Delete a user account.
   */
  async deleteUser(userId: string): Promise<void> {
    const user = await this.userRepository.getUser(userId);
    if (!user) {
      throw new AuthenticationError(`User not found: ${userId}`);
    }

    // Remove any active sessions for this user
    for (const [sessionId, session] of this.activeSessions.entries()) {
      if (session.user.id === userId) {
        this.activeSessions.delete(sessionId);
      }
    }

    await this.userRepository.deleteUser(userId);
  }

  /**
   * Create an auth session for a user.
   */
  createSession(user: User): AuthSession {
    const session: AuthSession = {
      user,
      sessionId: randomUUID(),
      createdAt: new Date(),
    };

    this.activeSessions.set(session.sessionId, session);
    return session;
  }

  /**
   * Get an active session by ID.
   */
  getSession(sessionId: string): AuthSession | null {
    return this.activeSessions.get(sessionId) || null;
  }

  /**
   * Get a user from a session ID.
   */
  async getUserFromSession(sessionId: string): Promise<User | null> {
    const session = this.activeSessions.get(sessionId);
    return session?.user || null;
  }

  /**
   * Destroy a session (logout).
   */
  destroySession(sessionId: string): void {
    this.activeSessions.delete(sessionId);
  }

  /**
   * Get all active sessions (for admin purposes).
   */
  getActiveSessions(): AuthSession[] {
    return Array.from(this.activeSessions.values());
  }

  /**
   * Clean up expired sessions (if we add expiration in the future).
   */
  cleanupSessions(): void {
    // For now, sessions don't expire
    // Can add expiration logic here later if needed
  }
}
