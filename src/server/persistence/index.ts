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
    // Initialize repositories that have standard initialize() method
    await Promise.all([
      this.sessions.initialize(),
      this.problems.initialize(),
      this.revisions.initialize(),
    ]);
    
    // NOTE: Type assertions below are necessary because repository interfaces don't declare
    // lifecycle methods (initialize, ensureInitialized, shutdown, health).
    // This is intentional - these methods are implementation-specific for local file storage
    // and won't exist when we migrate to Supabase. The interfaces only declare data operations.
    // TODO: Consider creating separate IInitializable, IShutdownable interfaces that
    // implementations can optionally implement for better type safety.
    
    // Initialize repositories with custom initialization methods
    const optionalInits: Promise<void>[] = [];
    const usersAny = this.users as any;
    if (usersAny.initialize && typeof usersAny.initialize === 'function') {
      optionalInits.push(usersAny.initialize());
    }
    const classesAny = this.classes as any;
    if (classesAny?.ensureInitialized && typeof classesAny.ensureInitialized === 'function') {
      optionalInits.push(classesAny.ensureInitialized());
    }
    const sectionsAny = this.sections as any;
    if (sectionsAny?.ensureInitialized && typeof sectionsAny.ensureInitialized === 'function') {
      optionalInits.push(sectionsAny.ensureInitialized());
    }
    const membershipsAny = this.memberships as any;
    if (membershipsAny?.ensureInitialized && typeof membershipsAny.ensureInitialized === 'function') {
      optionalInits.push(membershipsAny.ensureInitialized());
    }
    
    await Promise.all(optionalInits);
  }

  async shutdown(): Promise<void> {
    const shutdowns: Promise<void>[] = [
      this.sessions.shutdown(),
      this.problems.shutdown(),
      this.revisions.shutdown(),
    ];
    
    // Add optional shutdown for users repository
    const usersAny = this.users as any;
    if (usersAny.shutdown && typeof usersAny.shutdown === 'function') {
      shutdowns.push(usersAny.shutdown());
    }
    
    await Promise.all(shutdowns);
  }

  async health(): Promise<boolean> {
    const healthChecks: Promise<boolean>[] = [
      this.sessions.health(),
      this.problems.health(),
      this.revisions.health(),
    ];
    
    // Add optional health check for users repository
    const usersAny = this.users as any;
    if (usersAny.health && typeof usersAny.health === 'function') {
      healthChecks.push(usersAny.health());
    } else {
      healthChecks.push(Promise.resolve(true));
    }
    
    const results = await Promise.all(healthChecks);
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
