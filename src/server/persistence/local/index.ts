/**
 * Local file-based storage implementations
 * 
 * This module exports all local repository implementations that use
 * JSON files for persistence with in-memory caching.
 */

export { LocalSessionRepository } from './session-repository';
export { LocalRevisionRepository } from './revision-repository';
export { LocalUserRepository } from './user-repository';
export * from './utils';
