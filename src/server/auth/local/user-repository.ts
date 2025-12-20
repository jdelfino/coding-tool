/**
 * In-memory user repository implementation.
 * Stores users in memory for simple local authentication.
 * Can be replaced with database-backed implementation later.
 */

import { User, UserRole, AuthenticationError } from '../types';
import { IUserRepository } from '../interfaces';

/**
 * Simple in-memory user repository.
 * Users are stored in a Map for fast lookups.
 */
export class InMemoryUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private usernameIndex: Map<string, string> = new Map(); // username -> userId

  /**
   * Save a user to storage.
   * Creates new user if not exists, updates if exists.
   */
  async saveUser(user: User): Promise<void> {
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username.toLowerCase(), user.id);
  }

  /**
   * Get a user by their ID.
   */
  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  /**
   * Get a user by their username (case-insensitive).
   */
  async getUserByUsername(username: string): Promise<User | null> {
    const userId = this.usernameIndex.get(username.toLowerCase());
    if (!userId) {
      return null;
    }
    return this.users.get(userId) || null;
  }

  /**
   * List all users, optionally filtered by role.
   */
  async listUsers(role?: UserRole): Promise<User[]> {
    const allUsers = Array.from(this.users.values());
    if (role) {
      return allUsers.filter(user => user.role === role);
    }
    return allUsers;
  }

  /**
   * Get a user by their email.
   * In the current implementation, email and username are the same.
   */
  async getUserByEmail(email: string): Promise<User | null> {
    return this.getUserByUsername(email);
  }

  /**
   * Update user information.
   */
  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new AuthenticationError(`User not found: ${userId}`);
    }

    // If username is being changed, update the index
    if (updates.username && updates.username !== user.username) {
      this.usernameIndex.delete(user.username.toLowerCase());
      this.usernameIndex.set(updates.username.toLowerCase(), userId);
    }

    // Merge updates into existing user
    const updatedUser = { ...user, ...updates };
    this.users.set(userId, updatedUser);
  }

  /**
   * Delete a user from storage.
   */
  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new AuthenticationError(`User not found: ${userId}`);
    }

    this.usernameIndex.delete(user.username.toLowerCase());
    this.users.delete(userId);
  }

  /**
   * Get total user count (useful for bootstrapping first instructor).
   */
  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  /**
   * Clear all users (useful for testing).
   */
  async clear(): Promise<void> {
    this.users.clear();
    this.usernameIndex.clear();
  }
}
