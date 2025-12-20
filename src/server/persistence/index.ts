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
  LocalUserRepository,
} from './local';
import {
  ClassRepository,
  SectionRepository,
  MembershipRepository,
} from '../classes';
import {
  ISessionRepository,
  IProblemRepository,
  IRevisionRepository,
  IUserRepository,
  IStorageRepository,
} from './interfaces';
import type { IClassRepository, ISectionRepository, IMembershipRepository } from '../classes/interfaces';
import { StorageConfig } from './types';

/**
 * Composite storage backend that combines all repositories
 */
export class StorageBackend implements IStorageRepository {
  public readonly sessions: ISessionRepository;
  public readonly problems: IProblemRepository;
  public readonly revisions: IRevisionRepository;
  public readonly users: IUserRepository;
  public readonly classes?: IClassRepository;
  public readonly sections?: ISectionRepository;
  public readonly memberships?: IMembershipRepository;

  constructor(config: StorageConfig) {
    // Create repository instances
    this.sessions = new LocalSessionRepository(config);
    this.problems = new LocalProblemRepository(config);
    this.revisions = new LocalRevisionRepository(config);
    this.users = new LocalUserRepository(config);
    
    // Initialize class/section repositories (multi-tenancy)
    const baseDir = config.baseDir || './data';
    const sectionRepo = new SectionRepository(baseDir);
    const classRepo = new ClassRepository(baseDir);
    const membershipRepo = new MembershipRepository(baseDir);
    
    // Set up dependencies after construction
    membershipRepo.setRepositories(this.users, sectionRepo, classRepo);
    sectionRepo.setMembershipRepository(membershipRepo);
    classRepo.setSectionRepository(sectionRepo);
    
    // Assign to interface properties
    this.sections = sectionRepo;
    this.classes = classRepo;
    this.memberships = membershipRepo;
  }

  async initialize(): Promise<void> {
    await Promise.all([
      this.sessions.initialize(),
      this.problems.initialize(),
      this.revisions.initialize(),
      // Users repository has initialize but it's not in IUserRepository interface
      // We know LocalUserRepository has it, so cast to access it
      (this.users as any).initialize?.(),
      // Initialize class/section repositories
      (this.classes as any)?.ensureInitialized?.(),
      (this.sections as any)?.ensureInitialized?.(),
      (this.memberships as any)?.ensureInitialized?.(),
    ]);
  }

  async shutdown(): Promise<void> {
    await Promise.all([
      this.sessions.shutdown(),
      this.problems.shutdown(),
      this.revisions.shutdown(),
      (this.users as any).shutdown?.(),
    ]);
  }

  async health(): Promise<boolean> {
    const results = await Promise.all([
      this.sessions.health(),
      this.problems.health(),
      this.revisions.health(),
      // Health check for users if available
      (this.users as any).health?.() ?? Promise.resolve(true),
    ]);
    // All repositories must be healthy
    return results.every((r: boolean) => r);
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

// Mutable singleton instance holder
// Will be set in index.ts with a properly initialized instance
// Or auto-initialized on first access for API routes
export const storageHolder = {
  instance: null as IStorageRepository | null,
};

/**
 * Get or initialize the storage instance
 * Lazy initialization for API routes that run in separate process
 */
export async function getStorage(): Promise<IStorageRepository> {
  if (!storageHolder.instance) {
    console.log('[Storage] Auto-initializing storage for API routes');
    storageHolder.instance = await createDefaultStorage();
  }
  return storageHolder.instance;
}

// Re-export all types and interfaces for convenience
export * from './types';
export * from './interfaces';
export {
  LocalSessionRepository,
  LocalProblemRepository,
  LocalRevisionRepository,
} from './local';
