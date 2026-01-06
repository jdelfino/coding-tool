/**
 * Public API for persistence layer
 *
 * This module provides a simple factory function to create storage backends
 * and exposes all necessary types and interfaces.
 */

import {
  LocalSessionRepository,
  LocalRevisionRepository,
  LocalUserRepository,
} from './local';
import { LocalProblemRepository } from './local/problem-repository';
import {
  ClassRepository,
  SectionRepository,
  MembershipRepository,
} from '../classes';
import {
  ISessionRepository,
  IRevisionRepository,
  IUserRepository,
  IProblemRepository,
  IStorageRepository,
} from './interfaces';
import type { IClassRepository, ISectionRepository, IMembershipRepository } from '../classes/interfaces';
import { StorageConfig } from './types';

/**
 * Composite storage backend that combines all repositories
 */
export class StorageBackend implements IStorageRepository {
  public readonly sessions: ISessionRepository;
  public readonly revisions: IRevisionRepository;
  public readonly users: IUserRepository;
  public readonly problems: IProblemRepository;
  public readonly classes?: IClassRepository;
  public readonly sections?: ISectionRepository;
  public readonly memberships?: IMembershipRepository;

  constructor(config: StorageConfig) {
    // Create repository instances
    this.sessions = new LocalSessionRepository(config);
    this.revisions = new LocalRevisionRepository(config);
    this.users = new LocalUserRepository(config);
    this.problems = new LocalProblemRepository(config.baseDir || './data');

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
    // Initialize all repositories with optional lifecycle methods
    const optionalInits: Promise<void>[] = [];
    if (this.sessions.initialize) {
      optionalInits.push(this.sessions.initialize());
    }
    if (this.revisions.initialize) {
      optionalInits.push(this.revisions.initialize());
    }
    if (this.problems.initialize) {
      optionalInits.push(this.problems.initialize());
    }
    if (this.users.initialize) {
      optionalInits.push(this.users.initialize());
    }
    if (this.classes?.ensureInitialized) {
      optionalInits.push(this.classes.ensureInitialized());
    }
    if (this.sections?.ensureInitialized) {
      optionalInits.push(this.sections.ensureInitialized());
    }
    if (this.memberships?.ensureInitialized) {
      optionalInits.push(this.memberships.ensureInitialized());
    }

    await Promise.all(optionalInits);
  }

  async shutdown(): Promise<void> {
    const shutdowns: Promise<void>[] = [];

    // All lifecycle methods are optional
    if (this.sessions.shutdown) {
      shutdowns.push(this.sessions.shutdown());
    }
    if (this.revisions.shutdown) {
      shutdowns.push(this.revisions.shutdown());
    }
    if (this.problems.shutdown) {
      shutdowns.push(this.problems.shutdown());
    }
    if (this.users.shutdown) {
      shutdowns.push(this.users.shutdown());
    }

    await Promise.all(shutdowns);
  }

  async health(): Promise<boolean> {
    const healthChecks: Promise<boolean>[] = [];

    // All lifecycle methods are optional - if not implemented, assume healthy
    if (this.sessions.health) {
      healthChecks.push(this.sessions.health());
    }
    if (this.revisions.health) {
      healthChecks.push(this.revisions.health());
    }
    if (this.problems.health) {
      healthChecks.push(this.problems.health());
    }
    if (this.users.health) {
      healthChecks.push(this.users.health());
    }

    // If no health checks are implemented, assume healthy
    if (healthChecks.length === 0) {
      return true;
    }

    const results = await Promise.all(healthChecks);
    // All repositories must be healthy
    return results.every(r => r);
  }

  async transaction<T>(fn: (tx: import('./interfaces').TransactionContext) => Promise<T>): Promise<T> {
    // Local storage doesn't support real transactions - execute directly
    const context: import('./interfaces').TransactionContext = {
      sessions: this.sessions,
      revisions: this.revisions,
      problems: this.problems,
      users: this.users,
    };
    return fn(context);
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
    storageHolder.instance = await createDefaultStorage();
  }
  return storageHolder.instance;
}

// Re-export all types and interfaces for convenience
export * from './types';
export * from './interfaces';
export {
  LocalSessionRepository,
  LocalRevisionRepository,
} from './local';
