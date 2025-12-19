/**
 * Fake storage backend for unit testing.
 * Provides in-memory implementations of all storage interfaces.
 */

import { 
  StorageBackend, 
  ISessionRepository, 
  IRevisionRepository,
  IUserRepository,
} from '../../persistence/interfaces';
import { 
  StoredSession, 
  StoredRevision,
  StorageMetadata,
} from '../../persistence/types';
import { Session } from '../../types';
import { User } from '../../auth/types';

/**
 * Fake revision repository that stores revisions in memory
 */
export class FakeRevisionRepository implements IRevisionRepository {
  private revisions: Map<string, StoredRevision> = new Map();
  private sessionRevisions: Map<string, Map<string, StoredRevision[]>> = new Map();
  
  // Spy arrays to track method calls
  public saveRevisionCalls: StoredRevision[] = [];
  public getRevisionsCalls: Array<{ sessionId: string; studentId: string }> = [];

  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async health(): Promise<boolean> { return true; }

  async saveRevision(revision: Omit<StoredRevision, '_metadata'>): Promise<string> {
    const stored: StoredRevision = {
      ...revision,
      _metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      },
    };
    
    this.saveRevisionCalls.push(stored);
    this.revisions.set(revision.id, stored);
    
    // Index by session and student
    const sessionKey = `${revision.sessionId}-${revision.studentId}`;
    let sessionMap = this.sessionRevisions.get(revision.sessionId);
    if (!sessionMap) {
      sessionMap = new Map();
      this.sessionRevisions.set(revision.sessionId, sessionMap);
    }
    
    let studentRevisions = sessionMap.get(revision.studentId);
    if (!studentRevisions) {
      studentRevisions = [];
      sessionMap.set(revision.studentId, studentRevisions);
    }
    
    studentRevisions.push(stored);
    studentRevisions.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
    
    return revision.id;
  }

  async getRevisions(sessionId: string, studentId: string): Promise<StoredRevision[]> {
    this.getRevisionsCalls.push({ sessionId, studentId });
    
    const sessionMap = this.sessionRevisions.get(sessionId);
    if (!sessionMap) return [];
    
    return sessionMap.get(studentId) || [];
  }

  async getRevision(revisionId: string): Promise<StoredRevision | null> {
    return this.revisions.get(revisionId) || null;
  }

  async getLatestRevision(sessionId: string, studentId: string): Promise<StoredRevision | null> {
    const revisions = await this.getRevisions(sessionId, studentId);
    return revisions.length > 0 ? revisions[revisions.length - 1] : null;
  }

  async deleteRevision(revisionId: string): Promise<boolean> {
    return this.revisions.delete(revisionId);
  }

  async deleteSessionRevisions(sessionId: string): Promise<number> {
    const sessionMap = this.sessionRevisions.get(sessionId);
    if (!sessionMap) return 0;
    
    let count = 0;
    for (const [studentId, revisions] of sessionMap) {
      count += revisions.length;
      for (const rev of revisions) {
        this.revisions.delete(rev.id);
      }
    }
    
    this.sessionRevisions.delete(sessionId);
    return count;
  }

  async deleteStudentRevisions(sessionId: string, studentId: string): Promise<number> {
    const sessionMap = this.sessionRevisions.get(sessionId);
    if (!sessionMap) return 0;
    
    const revisions = sessionMap.get(studentId) || [];
    for (const rev of revisions) {
      this.revisions.delete(rev.id);
    }
    
    sessionMap.delete(studentId);
    return revisions.length;
  }

  async getAllSessionRevisions(sessionId: string): Promise<Map<string, StoredRevision[]>> {
    return this.sessionRevisions.get(sessionId) || new Map();
  }

  async countRevisions(sessionId: string, studentId?: string): Promise<number> {
    if (studentId) {
      const revisions = await this.getRevisions(sessionId, studentId);
      return revisions.length;
    }
    
    const sessionMap = this.sessionRevisions.get(sessionId);
    if (!sessionMap) return 0;
    
    let total = 0;
    for (const revisions of sessionMap.values()) {
      total += revisions.length;
    }
    return total;
  }

  // Helper methods for testing
  clear() {
    this.revisions.clear();
    this.sessionRevisions.clear();
    this.saveRevisionCalls = [];
    this.getRevisionsCalls = [];
  }

  getRevisionCount(): number {
    return this.revisions.size;
  }
}

/**
 * Fake session repository (minimal implementation for testing)
 */
export class FakeSessionRepository implements ISessionRepository {
  private sessions: Map<string, StoredSession> = new Map();

  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async health(): Promise<boolean> { return true; }

  async createSession(session: Session): Promise<string> {
    const stored: StoredSession = {
      ...session,
      _metadata: {
        createdAt: new Date(),
        updatedAt: new Date(),
        version: 1,
      },
    };
    this.sessions.set(session.id, stored);
    return session.id;
  }

  async getSession(sessionId: string): Promise<StoredSession | null> {
    return this.sessions.get(sessionId) || null;
  }

  async updateSession(sessionId: string, updates: Partial<Session>): Promise<void> {
    const existing = this.sessions.get(sessionId);
    if (existing) {
      Object.assign(existing, updates);
      if (existing._metadata) {
        existing._metadata.updatedAt = new Date();
        existing._metadata.version++;
      }
    }
  }

  async deleteSession(sessionId: string): Promise<void> {
    this.sessions.delete(sessionId);
  }

  async listActiveSessions(): Promise<StoredSession[]> {
    return Array.from(this.sessions.values()).filter(s => s.status === 'active');
  }

  async listAllSessions(): Promise<StoredSession[]> {
    return Array.from(this.sessions.values());
  }

  async getSessionByJoinCode(joinCode: string): Promise<StoredSession | null> {
    return Array.from(this.sessions.values()).find(s => s.joinCode === joinCode) || null;
  }

  async countSessions(): Promise<number> {
    return this.sessions.size;
  }

  // Helper methods for testing
  clear() {
    this.sessions.clear();
  }

  getSessionCount(): number {
    return this.sessions.size;
  }
}

/**
 * Fake user repository (minimal implementation for testing)
 */
export class FakeUserRepository implements IUserRepository {
  private users: Map<string, User> = new Map();
  private usernameIndex: Map<string, string> = new Map(); // username -> userId
  private nextId = 1;

  async initialize(): Promise<void> {}
  async shutdown(): Promise<void> {}
  async health(): Promise<boolean> { return true; }

  async createUser(user: Omit<User, 'id'>): Promise<User> {
    const newUser: User = {
      ...user,
      id: `user-${this.nextId++}`,
      createdAt: new Date(),
    };
    this.users.set(newUser.id, newUser);
    this.usernameIndex.set(newUser.username.toLowerCase(), newUser.id);
    return newUser;
  }

  async getUser(userId: string): Promise<User | null> {
    return this.users.get(userId) || null;
  }

  async getUserByUsername(username: string): Promise<User | null> {
    const userId = this.usernameIndex.get(username.toLowerCase());
    return userId ? this.users.get(userId) || null : null;
  }

  async getUserByEmail(email: string): Promise<User | null> {
    // In this system, email is the same as username
    return this.getUserByUsername(email);
  }

  async updateUser(userId: string, updates: Partial<User>): Promise<void> {
    const user = this.users.get(userId);
    if (!user) {
      throw new Error(`User not found: ${userId}`);
    }
    Object.assign(user, updates);
  }

  async deleteUser(userId: string): Promise<boolean> {
    const user = this.users.get(userId);
    if (!user) return false;
    this.usernameIndex.delete(user.username.toLowerCase());
    this.users.delete(userId);
    return true;
  }

  async listUsers(filters?: any): Promise<User[]> {
    return Array.from(this.users.values());
  }

  clear() {
    this.users.clear();
    this.usernameIndex.clear();
    this.nextId = 1;
  }
}

/**
 * Fake storage backend combining all repositories
 */
export class FakeStorageBackend implements StorageBackend {
  public readonly sessions: FakeSessionRepository;
  public readonly revisions: FakeRevisionRepository;
  public readonly users: FakeUserRepository;

  constructor() {
    this.sessions = new FakeSessionRepository();
    this.revisions = new FakeRevisionRepository();
    this.users = new FakeUserRepository();
  }

  async initialize(): Promise<void> {
    await this.sessions.initialize();
    await this.revisions.initialize();
    await this.users.initialize();
  }

  async shutdown(): Promise<void> {
    await this.sessions.shutdown();
    await this.revisions.shutdown();
    await this.users.shutdown();
  }

  async health(): Promise<{ 
    sessions: boolean; 
    revisions: boolean; 
    users: boolean; 
  }> {
    return {
      sessions: await this.sessions.health(),
      revisions: await this.revisions.health(),
      users: await this.users.health(),
    };
  }
}

/**
 * Create a fake storage backend for testing
 */
export function createFakeStorage(): FakeStorageBackend {
  return new FakeStorageBackend();
}
