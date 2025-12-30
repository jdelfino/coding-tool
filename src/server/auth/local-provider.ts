/**
 * Local authentication provider implementation.
 * Implements simple username-based authentication with auto-account creation.
 */

import { User, UserRole, AuthenticationError, AuthSession } from './types';
import { IAuthProvider, IUserRepository } from './interfaces';
import { randomUUID } from 'crypto';
import fs from 'fs/promises';
import path from 'path';

/**
 * Local authentication provider using simple username-based login.
 * Features:
 * - Auto-creates users on first login
 * - Users matching ADMIN_EMAIL become admins
 * - First user becomes instructor (if no ADMIN_EMAIL)
 * - Subsequent users are students
 * - No password required (trust-based for local development)
 */
export class LocalAuthProvider implements IAuthProvider {
  public readonly userRepository: IUserRepository;
  private activeSessions: Map<string, AuthSession> = new Map();
  private readonly sessionsFilePath: string;

  constructor(userRepository: IUserRepository, dataDir: string = './data') {
    this.userRepository = userRepository;
    this.sessionsFilePath = path.join(dataDir, 'auth-sessions.json');
  }

  /**
   * Load sessions from disk
   * Always reloads to ensure cross-process consistency
   */
  private async loadSessions(): Promise<void> {
    try {
      const data = await fs.readFile(this.sessionsFilePath, 'utf-8');
      const sessions = JSON.parse(data, (key, value) => {
        // Revive Date objects
        if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
          return new Date(value);
        }
        return value;
      }) as Record<string, AuthSession>;

      // Clear and reload to get latest from disk
      this.activeSessions.clear();
      for (const [sessionId, session] of Object.entries(sessions)) {
        this.activeSessions.set(sessionId, session);
      }
      
    } catch (error: any) {
      if (error.code !== 'ENOENT') {
        console.error('[Auth] Error loading sessions:', error);
      }
      // File doesn't exist yet, that's okay
      this.activeSessions.clear();
    }
  }

  /**
   * Save sessions to disk
   */
  private async saveSessions(): Promise<void> {
    try {
      const sessions: Record<string, AuthSession> = {};
      for (const [sessionId, session] of this.activeSessions.entries()) {
        sessions[sessionId] = session;
      }

      const data = JSON.stringify(sessions, null, 2);
      await fs.writeFile(this.sessionsFilePath, data, 'utf-8');
    } catch (error) {
      console.error('[Auth] Error saving sessions:', error);
    }
  }

  /**
   * Authenticate a user with their username.
   * Auto-creates user if they don't exist.
   * Role assignment:
   * 1. Users matching ADMIN_EMAIL -> admin
   * 2. First user (if no ADMIN_EMAIL) -> instructor
   * 3. Subsequent users -> student
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
      const allUsers = await this.userRepository.listUsers();
      const userCount = allUsers.length;
      
      // Determine role
      let role: UserRole;
      const adminEmail = process.env.ADMIN_EMAIL?.trim();
      
      if (adminEmail && normalizedUsername.toLowerCase() === adminEmail.toLowerCase()) {
        // Bootstrap admin from ADMIN_EMAIL
        role = 'admin';
      } else if (userCount === 0) {
        // First user becomes instructor (if no ADMIN_EMAIL set)
        role = 'instructor';
      } else {
        // Subsequent users are students
        role = 'student';
      }
      
      user = await this.createUser(normalizedUsername, role);
      console.log(`[Auth] Created new ${role} account: ${normalizedUsername}`);
    } else {
      // Check if existing user should be elevated to admin
      const adminEmail = process.env.ADMIN_EMAIL?.trim();
      if (adminEmail && 
          normalizedUsername.toLowerCase() === adminEmail.toLowerCase() &&
          user.role !== 'admin') {
        console.log(`[Auth] Elevating user to admin: ${normalizedUsername}`);
        await this.userRepository.updateUser(user.id, { role: 'admin' });
        user = await this.userRepository.getUser(user.id) as User;
      }
      
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
  async createSession(user: User): Promise<AuthSession> {
    await this.loadSessions(); // Ensure sessions are loaded

    const session: AuthSession = {
      user,
      sessionId: randomUUID(),
      createdAt: new Date(),
    };

    this.activeSessions.set(session.sessionId, session);
    await this.saveSessions(); // Persist to disk
    return session;
  }

  /**
   * Get an active session by ID.
   */
  async getSession(sessionId: string): Promise<AuthSession | null> {
    await this.loadSessions(); // Always reload to get latest from other processes
    const session = this.activeSessions.get(sessionId) || null;
    return session;
  }

  /**
   * Get a user from a session ID.
   */
  async getUserFromSession(sessionId: string): Promise<User | null> {
    await this.loadSessions(); // Ensure sessions are loaded
    const session = this.activeSessions.get(sessionId);
    return session?.user || null;
  }

  /**
   * Destroy a session (logout).
   */
  async destroySession(sessionId: string): Promise<void> {
    await this.loadSessions(); // Ensure sessions are loaded
    this.activeSessions.delete(sessionId);
    await this.saveSessions(); // Persist to disk
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

  /**
   * Get all users in the system.
   * For admin purposes only.
   */
  async getAllUsers(): Promise<User[]> {
    return this.userRepository.listUsers();
  }
}
