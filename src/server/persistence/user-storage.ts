/**
 * User storage implementation using local file persistence
 * 
 * Implements user repository with disk persistence using the same
 * pattern as the session/problem/revision repositories.
 */

import fs from 'fs/promises';
import path from 'path';
import { User, UserRole, AuthenticationError } from '../auth/types';
import { IUserRepository } from '../auth/interfaces';
import { StorageConfig, PersistenceError, PersistenceErrorCode } from './types';

/**
 * Helper to ensure directory exists
 */
async function ensureDir(dirPath: string): Promise<void> {
  try {
    await fs.mkdir(dirPath, { recursive: true });
  } catch (error) {
    throw new PersistenceError(
      `Failed to create directory: ${dirPath}`,
      PersistenceErrorCode.STORAGE_ERROR,
      error
    );
  }
}

/**
 * Helper for atomic file writes (write to temp, then rename)
 */
async function atomicWrite(filePath: string, data: string): Promise<void> {
  const tempPath = `${filePath}.tmp`;
  try {
    await fs.writeFile(tempPath, data, 'utf-8');
    await fs.rename(tempPath, filePath);
  } catch (error) {
    // Clean up temp file if it exists
    try {
      await fs.unlink(tempPath);
    } catch {}
    throw new PersistenceError(
      `Failed to write file: ${filePath}`,
      PersistenceErrorCode.STORAGE_ERROR,
      error
    );
  }
}

/**
 * Helper to read JSON file safely
 */
async function readJsonFile<T>(filePath: string, defaultValue: T): Promise<T> {
  try {
    const data = await fs.readFile(filePath, 'utf-8');
    return JSON.parse(data, (key, value) => {
      // Revive Date objects
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value);
      }
      return value;
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return default
      return defaultValue;
    }
    throw new PersistenceError(
      `Failed to read file: ${filePath}`,
      PersistenceErrorCode.STORAGE_ERROR,
      error
    );
  }
}

/**
 * Helper to write JSON file safely with atomic write
 */
async function writeJsonFile(filePath: string, data: any): Promise<void> {
  const jsonData = JSON.stringify(data, null, 2);
  await atomicWrite(filePath, jsonData);
}

/**
 * Persistent user repository implementation
 */
export class PersistentUserRepository implements IUserRepository {
  private readonly filePath: string;
  private readonly users: Map<string, User> = new Map();
  private readonly usernameIndex: Map<string, string> = new Map(); // username -> userId
  private initialized = false;

  constructor(private readonly config: StorageConfig) {
    const baseDir = config.baseDir || './data';
    this.filePath = path.join(baseDir, 'users.json');
  }

  /**
   * Initialize the repository and load users from disk
   */
  async initialize(): Promise<void> {
    if (this.initialized) return;

    const baseDir = this.config.baseDir || './data';
    await ensureDir(baseDir);

    // Load existing users into memory
    const userData = await readJsonFile<Record<string, User>>(
      this.filePath,
      {}
    );

    for (const [id, user] of Object.entries(userData)) {
      this.users.set(id, user);
      this.usernameIndex.set(user.username.toLowerCase(), id);
    }

    this.initialized = true;
    console.log(`[UserStorage] Loaded ${this.users.size} users from disk`);
  }

  /**
   * Persist current state to disk
   */
  private async persist(): Promise<void> {
    if (!this.initialized) {
      throw new Error('Repository not initialized');
    }

    // Convert Map to object for JSON serialization
    const userData: Record<string, User> = {};
    for (const [id, user] of this.users.entries()) {
      userData[id] = user;
    }

    await writeJsonFile(this.filePath, userData);
  }

  /**
   * Save a user to storage.
   * Creates new user if not exists, updates if exists.
   */
  async saveUser(user: User): Promise<void> {
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username.toLowerCase(), user.id);
    await this.persist();
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
    await this.persist();
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
    await this.persist();
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
    await this.persist();
  }
}
