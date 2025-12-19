/**
 * Singleton instance of authentication provider.
 * Used by API routes and server-side code.
 */

import { LocalAuthProvider } from './local-provider';
import { IAuthProvider } from './interfaces';
import type { IStorageRepository } from '../persistence/interfaces';

let authProviderInstance: IAuthProvider | null = null;
let storageInstance: IStorageRepository | null = null;

export function setStorage(storage: IStorageRepository): void {
  storageInstance = storage;
}

export function initializeAuthProvider(storage: IStorageRepository): IAuthProvider {
  storageInstance = storage;
  if (!authProviderInstance) {
    // Use the user repository from the storage backend
    authProviderInstance = new LocalAuthProvider(storage.users);
    console.log('[Auth] Initialized auth provider with persistent user storage');
  }
  return authProviderInstance;
}

export function getAuthProvider(): IAuthProvider {
  if (!authProviderInstance) {
    if (!storageInstance) {
      throw new Error('Storage not initialized. Cannot create auth provider.');
    }
    // Lazy initialization using stored storage instance
    authProviderInstance = new LocalAuthProvider(storageInstance.users);
    console.log('[Auth] Lazy-initialized auth provider');
  }
  return authProviderInstance;
}

