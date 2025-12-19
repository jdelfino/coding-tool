/**
 * Singleton instance of authentication provider.
 * Used by API routes and server-side code.
 */

import { LocalAuthProvider } from './local-provider';
import { IAuthProvider } from './interfaces';
import type { IStorageRepository } from '../persistence/interfaces';

let authProviderInstance: IAuthProvider | null = null;

export function initializeAuthProvider(storage: IStorageRepository): IAuthProvider {
  if (!authProviderInstance) {
    // Use the user repository from the storage backend
    authProviderInstance = new LocalAuthProvider(storage.users);
    console.log('[Auth] Initialized auth provider with persistent user storage');
  }
  return authProviderInstance;
}

export function getAuthProvider(): IAuthProvider {
  if (!authProviderInstance) {
    throw new Error('Auth provider not initialized. Call initializeAuthProvider() first.');
  }
  return authProviderInstance;
}

