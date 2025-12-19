/**
 * Singleton instance of authentication provider.
 * Used by API routes and server-side code.
 */

import { LocalAuthProvider } from './local-provider';
import { IAuthProvider } from './interfaces';
import { storageHolder } from '../persistence';

let authProviderInstance: IAuthProvider | null = null;

export function getAuthProvider(): IAuthProvider {
  if (!authProviderInstance) {
    if (!storageHolder.instance) {
      throw new Error('Storage not initialized. Cannot create auth provider.');
    }
    // Lazy initialization using storage holder
    authProviderInstance = new LocalAuthProvider(storageHolder.instance.users);
    console.log('[Auth] Lazy-initialized auth provider');
  }
  return authProviderInstance;
}

