/**
 * Local file-based session repository implementation
 */

import fs from 'fs/promises';
import path from 'path';
import { Session } from '../../types';
import { ISessionRepository } from '../interfaces';
import {
  StorageConfig,
  SessionQueryOptions,
  StoredSession,
  PersistenceError,
  PersistenceErrorCode,
} from '../types';
import { createMetadata, ensureDir, readJsonFile, writeJsonFile } from './utils';

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
    // Flush cache to disk only if initialized
    if (this.initialized) {
      await this.flush();
    }
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

  async transaction<T>(fn: (tx: import('../interfaces').TransactionContext) => Promise<T>): Promise<T> {
    // Local storage doesn't support real transactions - execute directly
    // Transaction context would need to be provided by StorageBackend
    throw new Error('Transaction not supported at repository level. Use StorageBackend.transaction()');
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
    // Reload from disk to get latest data from other processes (e.g., WebSocket updates)
    await this.reloadFromDisk();
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

  async listActiveSessions(namespaceId?: string): Promise<StoredSession[]> {
    // Assuming sessions have an 'active' property (from Session type)
    // If not, we'll return all sessions for now
    let sessions = Array.from(this.cache.values());

    // Apply namespace filter
    if (namespaceId) {
      sessions = sessions.filter(s => s.namespaceId === namespaceId);
    }

    return sessions;
  }

  async listAllSessions(options?: SessionQueryOptions, namespaceId?: string): Promise<StoredSession[]> {
    // Reload from disk to get latest data from other processes
    await this.reloadFromDisk();

    let sessions = Array.from(this.cache.values());

    // Apply namespace filter first
    if (namespaceId) {
      sessions = sessions.filter(s => s.namespaceId === namespaceId);
    }

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
        const field = options.sortBy! as keyof StoredSession;
        const aVal = a[field] ?? '';
        const bVal = b[field] ?? '';
        if (aVal < bVal) return -order;
        if (aVal > bVal) return order;
        return 0;
      });
    }

    return sessions;
  }

  async countSessions(options?: SessionQueryOptions): Promise<number> {
    const sessions = await this.listAllSessions(options);
    return sessions.length;
  }
}
