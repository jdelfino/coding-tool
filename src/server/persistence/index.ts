/**
 * Public API for persistence layer
 * 
 * This module provides a simple factory function to create storage backends
 * and exposes all necessary types and interfaces.
 */

import {
  LocalSessionRepository,
  LocalProblemRepository,
  LocalRevisionRepository,
} from './local-storage';
import {
  ISessionRepository,
  IProblemRepository,
  IRevisionRepository,
  IStorageRepository,
} from './interfaces';
import { StorageConfig } from './types';

/**
 * Composite storage backend that combines all repositories
 */
export class StorageBackend implements IStorageRepository {
  public readonly sessions: ISessionRepository;
  public readonly problems: IProblemRepository;
  public readonly revisions: IRevisionRepository;

  constructor(config: StorageConfig) {
    // Create repository instances
    this.sessions = new LocalSessionRepository(config);
    this.problems = new LocalProblemRepository(config);
    this.revisions = new LocalRevisionRepository(config);
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.sessions.initialize(),
      this.problems.initialize(),
      this.revisions.initialize(),
    ]);
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.sessions.shutdown(),
      this.problems.shutdown(),
      this.revisions.shutdown(),
    ]);
  }

  async health(): Promise<boolean> {
    const results = await Promise.all([
      this.sessions.health(),
      this.problems.health(),
      this.revisions.health(),
    ]);
    // All repositories must be healthy
    return results.every(r => r);
  }
}

/**
 * Factory function to create and initialize a storage backend
 * 
 * @param config - Storage configuration
 * @returns Initialized storage backend
 * 
 * @example
 * ```typescript
 * const storage = await createStorage({
 *   type: 'local',
 *   baseDir: './data'
 * });
 * 
 * // Use storage
 * const session = await storage.sessions.getSession('session-123');
 * 
 * // Clean up when done
 * await storage.shutdown();
 * ```
 */
export async function createStorage(config: StorageConfig): Promise<IStorageRepository> {
  const storage = new StorageBackend(config);
  await storage.initialize();
  return storage;
}

/**
 * Create storage with default configuration
 * 
 * Uses local file storage in ./data directory
 */
export async function createDefaultStorage(): Promise<IStorageRepository> {
  return createStorage({
    type: 'local',
    baseDir: './data',
    enableCache: true,
  });
}

// Re-export all types and interfaces for convenience
export * from './types';
export * from './interfaces';
export {
  LocalSessionRepository,
  LocalProblemRepository,
  LocalRevisionRepository,
} from './local-storage';
