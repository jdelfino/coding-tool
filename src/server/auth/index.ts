/**
 * Authentication module exports.
 * Provides convenient access to auth types, interfaces, and implementations.
 */

// Types
export * from './types';

// Interfaces
export * from './interfaces';

// Implementations
export { InMemoryUserRepository } from './user-repository';
export { LocalAuthProvider } from './local-provider';
export { RBACService } from './rbac';

// Permissions
export * from './permissions';

// Middleware
export * from './middleware';

// Instance
export { getAuthProvider, initializeAuthProvider, setStorage } from './instance';
