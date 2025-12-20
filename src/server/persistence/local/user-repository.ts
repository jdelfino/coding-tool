/**
 * Local file-based user repository implementation
 */

import fs from 'fs/promises';
import path from 'path';
import { User, UserRole, AuthenticationError } from '../../auth/types';
import { IUserRepository } from '../../auth/interfaces';
import { StorageConfig } from '../types';
import { ensureDir, readJsonFile, writeJsonFile } from './utils';

/**
 * Local file-based user repository implementation
 */
export class LocalUserRepository implements IUserRepository {
  private readonly filePath: string;
  private readonly users: Map<string, User> = new Map();
  private readonly usernameIndex: Map<string, string> = new Map(); // username -> userId
  private initialized = false;

  constructor(private readonly config: StorageConfig) {
    const baseDir = config.baseDir || './data';
    this.filePath = path.join(baseDir, 'users.json');
  }

  async initialize(): Promise<void> {
    if (this.initialized) return;

    const baseDir = this.config.baseDir || './data';
    await ensureDir(baseDir);

    await this.reloadFromDisk();

    this.initialized = true;
    console.log(`[UserStorage] Loaded ${this.users.size} users from disk`);
  }

  /**
   * Reload users from disk (for cross-process consistency)
   */
  private async reloadFromDisk(): Promise<void> {
    // Load existing users into memory
    const userData = await readJsonFile<Record<string, User>>(
      this.filePath,
      {}
    );

    this.users.clear();
    this.usernameIndex.clear();
    for (const [id, user] of Object.entries(userData)) {
      this.users.set(id, user);
      this.usernameIndex.set(user.username.toLowerCase(), id);
    }
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.users.clear();
    this.usernameIndex.clear();
    this.initialized = false;
  }

  async health(): Promise<boolean> {
    try {
      const baseDir = this.config.baseDir || './data';
      await fs.access(baseDir);
      return true;
    } catch {
      return false;
    }
  }

  private async flush(): Promise<void> {
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

  async saveUser(user: User): Promise<void> {
    this.users.set(user.id, user);
    this.usernameIndex.set(user.username.toLowerCase(), user.id);
    await this.flush();
  }

  async getUser(userId: string): Promise<User | null> {
    // Reload from disk to get latest data from other processes
    await this.reloadFromDisk();
    return this.users.get(userId) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    // Reload from disk to get latest data from other processes
    await this.reloadFromDisk();
    const userId = this.usernameIndex.get(username.toLowerCase());
    if (!userId) {
      return null;
    }
    return this.users.get(userId) || null;
  }

  async listUsers(role?: UserRole): Promise<User[]> {
    // Reload from disk to get latest data from other processes
    await this.reloadFromDisk();
    const allUsers = Array.from(this.users.values());
    if (role) {
      return allUsers.filter(user => user.role === role);
    }
    return allUsers;
  }

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
    await this.flush();
  }

  async deleteUser(userId: string): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new AuthenticationError(`User not found: ${userId}`);
    }

    this.usernameIndex.delete(user.username.toLowerCase());
    this.users.delete(userId);
    await this.flush();
  }

  async getUserCount(): Promise<number> {
    return this.users.size;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    // In this system, email is the same as username
    return this.getUserByUsername(email);
  }

  async clear(): Promise<void> {
    this.users.clear();
    this.usernameIndex.clear();
    await this.flush();
  }
}
