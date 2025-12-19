/**
 * Singleton instance of authentication provider.
 * Used by API routes and server-side code.
 */

import { LocalAuthProvider } from './local-provider';
import { PersistentUserRepository } from '../persistence/user-storage';
import { IAuthProvider } from './interfaces';

let authProviderInstance: IAuthProvider | null = null;
let userRepositoryInstance: PersistentUserRepository | null = null;

export async function initializeAuthProvider(): Promise<IAuthProvider> {
  if (!authProviderInstance) {
    // Create persistent user repository
    userRepositoryInstance = new PersistentUserRepository({
      type: 'local',
      baseDir: './data'
    });
    
    // Initialize repository (loads users from disk)
    await userRepositoryInstance.initialize();
    
    authProviderInstance = new LocalAuthProvider(userRepositoryInstance);
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

