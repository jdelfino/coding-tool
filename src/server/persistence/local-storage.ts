/**
 * Local file-based storage implementation
 * 
 * Implements all repository interfaces using local JSON files for persistence.
 * Provides in-memory caching for performance while maintaining data on disk.
 */

import fs from 'fs/promises';
import path from 'path';
import { Session } from '../types';
import { User, UserRole, AuthenticationError } from '../auth/types';
import { IUserRepository } from '../auth/interfaces';
import {
  ISessionRepository,
  IProblemRepository,
  IRevisionRepository,
} from './interfaces';
import {
  StorageConfig,
  ProblemSpec,
  CodeRevision,
  SessionQueryOptions,
  StoredSession,
  StoredProblem,
  StoredRevision,
  PersistenceError,
  PersistenceErrorCode,
  StorageMetadata,
} from './types';

/**
 * Helper to create storage metadata
 */
function createMetadata(existing?: StorageMetadata): StorageMetadata {
  const now = new Date();
  return {
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    version: (existing?.version || 0) + 1,
  };
}

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
      // Revive Map objects (serialized as {__type: 'Map', entries: [[k,v], ...]})
      if (value && typeof value === 'object' && value.__type === 'Map') {
        return new Map(value.entries);
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
 * Includes custom serialization for Map objects
 */
async function writeJsonFile(filePath: string, data: any): Promise<void> {
  const jsonData = JSON.stringify(data, (key, value) => {
    // Serialize Map objects
    if (value instanceof Map) {
      return {
        __type: 'Map',
        entries: Array.from(value.entries()),
      };
    }
    return value;
  }, 2);
  await atomicWrite(filePath, jsonData);
}

/**
 * Local file-based session repository implementation
 */
export class LocalSessionRepository implements ISessionRepository {
  private readonly filePath: string;
  private readonly cache: Map<string, StoredSession> = new Map();
  private initialized = false;

  constructor(private readonly config: StorageConfig) {
    const baseDir = config.baseDir || './data';
    this.filePath = path.join(baseDir, 'sessions.json');
  }

  async initialize(): Promise<void> {
    const baseDir = this.config.baseDir || './data';
    await ensureDir(baseDir);
    
    await this.reloadFromDisk();
    
    this.initialized = true;
  }

  /**
   * Reload sessions from disk (for cross-process consistency)
   */
  private async reloadFromDisk(): Promise<void> {
    // Load existing sessions into cache
    const sessions = await readJsonFile<Record<string, StoredSession>>(
      this.filePath,
      {}
    );
    
    this.cache.clear();
    for (const [id, session] of Object.entries(sessions)) {
      this.cache.set(id, session);
    }
  }

  async shutdown(): Promise<void> {
    // Flush cache to disk
    await this.flush();
    this.cache.clear();
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
    const sessions: Record<string, StoredSession> = {};
    for (const [id, session] of this.cache.entries()) {
      sessions[id] = session;
    }
    await writeJsonFile(this.filePath, sessions);
  }

  async createSession(session: Session): Promise<string> {
    const stored: StoredSession = {
      ...session,
      _metadata: createMetadata(),
    };
    
    if (this.cache.has(session.id)) {
      throw new PersistenceError(
        `Session already exists: ${session.id}`,
        PersistenceErrorCode.ALREADY_EXISTS
      );
    }
    
    this.cache.set(session.id, stored);
    await this.flush();
    
    return session.id;
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    return this.cache.get(sessionId) || null;
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    const existing = this.cache.get(sessionId);
    if (!existing) {
      throw new PersistenceError(
        `Session not found: ${sessionId}`,
        PersistenceErrorCode.NOT_FOUND
      );
    }
    
    const updated: StoredSession = {
      ...existing,
      ...updates,
      id: sessionId, // Ensure ID doesn't change
      _metadata: createMetadata(existing._metadata),
    };
    
    this.cache.set(sessionId, updated);
    await this.flush();
  }

  async deleteSession(sessionId: string): Promise<void> {
    if (!this.cache.has(sessionId)) {
      throw new PersistenceError(
        `Session not found: ${sessionId}`,
        PersistenceErrorCode.NOT_FOUND
      );
    }
    
    this.cache.delete(sessionId);
    await this.flush();
  }

  async listActiveSessions(): Promise<StoredSession[]> {
    // Assuming sessions have an 'active' property (from Session type)
    // If not, we'll return all sessions for now
    return Array.from(this.cache.values());
  }

  async listAllSessions(options?: SessionQueryOptions): Promise<StoredSession[]> {
    // Reload from disk to get latest data from other processes
    await this.reloadFromDisk();
    
    let sessions = Array.from(this.cache.values());
    
    // Apply filters
    if (options?.active !== undefined) {
      // Note: This assumes Session type will have an 'active' field
      // sessions = sessions.filter(s => s.active === options.active);
    }
    
    // Apply limit and offset
    if (options?.offset) {
      sessions = sessions.slice(options.offset);
    }
    if (options?.limit) {
      sessions = sessions.slice(0, options.limit);
    }
    
    // Apply sorting
    if (options?.sortBy) {
      const order = options.sortOrder === 'desc' ? -1 : 1;
      sessions.sort((a, b) => {
        const field = options.sortBy!;
        const aVal = (a as any)[field];
        const bVal = (b as any)[field];
        if (aVal < bVal) return -order;
        if (aVal > bVal) return order;
        return 0;
      });
    }
    
    return sessions;
  }

  async getSessionByJoinCode(joinCode: string): Promise<StoredSession | null> {
    for (const session of this.cache.values()) {
      if (session.joinCode === joinCode) {
        return session;
      }
    }
    return null;
  }

  async countSessions(options?: SessionQueryOptions): Promise<number> {
    const sessions = await this.listAllSessions(options);
    return sessions.length;
  }
}

/**
 * Local file-based problem repository implementation
 */
export class LocalProblemRepository implements IProblemRepository {
  private readonly filePath: string;
  private readonly cache: Map<string, StoredProblem> = new Map();
  private initialized = false;

  constructor(private readonly config: StorageConfig) {
    const baseDir = config.baseDir || './data';
    this.filePath = path.join(baseDir, 'problems.json');
  }

  async initialize(): Promise<void> {
    const baseDir = this.config.baseDir || './data';
    await ensureDir(baseDir);
    
    const problems = await readJsonFile<Record<string, StoredProblem>>(
      this.filePath,
      {}
    );
    
    for (const [id, problem] of Object.entries(problems)) {
      this.cache.set(id, problem);
    }
    
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.cache.clear();
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
    const problems: Record<string, StoredProblem> = {};
    for (const [id, problem] of this.cache.entries()) {
      problems[id] = problem;
    }
    await writeJsonFile(this.filePath, problems);
  }

  async saveProblem(problem: ProblemSpec): Promise<string> {
    const stored: StoredProblem = {
      ...problem,
      _metadata: createMetadata(this.cache.get(problem.id)?._metadata),
    };
    
    this.cache.set(problem.id, stored);
    await this.flush();
    
    return problem.id;
  }

  async getProblem(problemId: string): Promise<StoredProblem | null> {
    return this.cache.get(problemId) || null;
  }

  async updateProblem(problemId: string, updates: Partial<ProblemSpec>): Promise<void> {
    const existing = this.cache.get(problemId);
    if (!existing) {
      throw new PersistenceError(
        `Problem not found: ${problemId}`,
        PersistenceErrorCode.NOT_FOUND
      );
    }
    
    const updated: StoredProblem = {
      ...existing,
      ...updates,
      id: problemId,
      _metadata: createMetadata(existing._metadata),
    };
    
    this.cache.set(problemId, updated);
    await this.flush();
  }

  async deleteProblem(problemId: string): Promise<void> {
    if (!this.cache.has(problemId)) {
      throw new PersistenceError(
        `Problem not found: ${problemId}`,
        PersistenceErrorCode.NOT_FOUND
      );
    }
    
    this.cache.delete(problemId);
    await this.flush();
  }

  async listProblems(filters?: {
    difficulty?: 'beginner' | 'intermediate' | 'advanced';
    tags?: string[];
    createdBy?: string;
    limit?: number;
    offset?: number;
  }): Promise<StoredProblem[]> {
    let problems = Array.from(this.cache.values());
    
    // Apply filters
    if (filters?.difficulty) {
      problems = problems.filter(p => p.difficulty === filters.difficulty);
    }
    if (filters?.tags && filters.tags.length > 0) {
      problems = problems.filter(p => 
        p.tags?.some(tag => filters.tags!.includes(tag))
      );
    }
    if (filters?.createdBy) {
      problems = problems.filter(p => p.createdBy === filters.createdBy);
    }
    
    // Apply pagination
    if (filters?.offset) {
      problems = problems.slice(filters.offset);
    }
    if (filters?.limit) {
      problems = problems.slice(0, filters.limit);
    }
    
    return problems;
  }

  async searchProblems(query: string, limit?: number): Promise<StoredProblem[]> {
    const lowerQuery = query.toLowerCase();
    let problems = Array.from(this.cache.values()).filter(p =>
      p.title.toLowerCase().includes(lowerQuery) ||
      p.description.toLowerCase().includes(lowerQuery)
    );
    
    if (limit) {
      problems = problems.slice(0, limit);
    }
    
    return problems;
  }
}

/**
 * Local file-based revision repository implementation
 */
export class LocalRevisionRepository implements IRevisionRepository {
  private readonly filePath: string;
  // Cache: sessionId-studentId -> revisions
  private readonly cache: Map<string, StoredRevision[]> = new Map();
  private initialized = false;

  constructor(private readonly config: StorageConfig) {
    const baseDir = config.baseDir || './data';
    this.filePath = path.join(baseDir, 'revisions.json');
  }

  private getCacheKey(sessionId: string, studentId: string): string {
    return `${sessionId}:${studentId}`;
  }

  async initialize(): Promise<void> {
    const baseDir = this.config.baseDir || './data';
    await ensureDir(baseDir);
    
    const revisions = await readJsonFile<Record<string, StoredRevision[]>>(
      this.filePath,
      {}
    );
    
    for (const [key, revs] of Object.entries(revisions)) {
      this.cache.set(key, revs);
    }
    
    this.initialized = true;
  }

  async shutdown(): Promise<void> {
    await this.flush();
    this.cache.clear();
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
    const revisions: Record<string, StoredRevision[]> = {};
    for (const [key, revs] of this.cache.entries()) {
      revisions[key] = revs;
    }
    await writeJsonFile(this.filePath, revisions);
  }

  async saveRevision(revision: CodeRevision): Promise<string> {
    const key = this.getCacheKey(revision.sessionId, revision.studentId);
    const revisions = this.cache.get(key) || [];
    
    const stored: StoredRevision = {
      ...revision,
      _metadata: createMetadata(),
    };
    
    revisions.push(stored);
    this.cache.set(key, revisions);
    await this.flush();
    
    return revision.id;
  }

  async getRevisions(sessionId: string, studentId: string): Promise<StoredRevision[]> {
    const key = this.getCacheKey(sessionId, studentId);
    return this.cache.get(key) || [];
  }

  async getRevision(revisionId: string): Promise<StoredRevision | null> {
    for (const revisions of this.cache.values()) {
      const found = revisions.find(r => r.id === revisionId);
      if (found) return found;
    }
    return null;
  }

  async getLatestRevision(sessionId: string, studentId: string): Promise<StoredRevision | null> {
    const revisions = await this.getRevisions(sessionId, studentId);
    return revisions.length > 0 ? revisions[revisions.length - 1] : null;
  }

  async deleteRevisions(sessionId: string, studentId?: string): Promise<void> {
    if (studentId) {
      // Delete for specific student
      const key = this.getCacheKey(sessionId, studentId);
      this.cache.delete(key);
    } else {
      // Delete all revisions for session
      const keysToDelete: string[] = [];
      for (const key of this.cache.keys()) {
        if (key.startsWith(`${sessionId}:`)) {
          keysToDelete.push(key);
        }
      }
      for (const key of keysToDelete) {
        this.cache.delete(key);
      }
    }
    await this.flush();
  }

  async countRevisions(sessionId: string, studentId: string): Promise<number> {
    const revisions = await this.getRevisions(sessionId, studentId);
    return revisions.length;
  }

  async getAllSessionRevisions(sessionId: string): Promise<Map<string, StoredRevision[]>> {
    const result = new Map<string, StoredRevision[]>();
    
    for (const [key, revisions] of this.cache.entries()) {
      if (key.startsWith(`${sessionId}:`)) {
        const studentId = key.split(':')[1];
        result.set(studentId, revisions);
      }
    }
    
    return result;
  }
}

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
    return this.users.get(userId) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const userId = this.usernameIndex.get(username.toLowerCase());
    if (!userId) {
      return null;
    }
    return this.users.get(userId) || null;
  }

  async listUsers(role?: UserRole): Promise<User[]> {
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

  async clear(): Promise<void> {
    this.users.clear();
    this.usernameIndex.clear();
    await this.flush();
  }
}
