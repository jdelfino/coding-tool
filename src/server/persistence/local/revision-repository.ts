/**
 * Local file-based revision repository implementation
 */

import fs from 'fs/promises';
import path from 'path';
import { IRevisionRepository } from '../interfaces';
import {
  StorageConfig,
  CodeRevision,
  StoredRevision,
} from '../types';
import { createMetadata, ensureDir, readJsonFile, writeJsonFile } from './utils';

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
    
    await this.reloadFromDisk();
    
    this.initialized = true;
  }

  /**
   * Reload revisions from disk (for cross-process consistency)
   */
  private async reloadFromDisk(): Promise<void> {
    const revisions = await readJsonFile<Record<string, StoredRevision[]>>(
      this.filePath,
      {}
    );
    
    this.cache.clear();
    for (const [key, revs] of Object.entries(revisions)) {
      this.cache.set(key, revs);
    }
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
    // Reload from disk to get latest data from other processes
    await this.reloadFromDisk();
    const key = this.getCacheKey(sessionId, studentId);
    return this.cache.get(key) || [];
  }

  async getRevision(revisionId: string): Promise<StoredRevision | null> {
    // Reload from disk to get latest data from other processes
    await this.reloadFromDisk();
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
