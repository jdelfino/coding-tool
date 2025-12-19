/**
 * Singleton instance of authentication provider.
 * Used by API routes and server-side code.
 */

import { LocalAuthProvider } from './local-provider';
import { IAuthProvider, IUserRepository } from './interfaces';
import { getStorage } from '../persistence';
import { InMemoryUserRepository } from './user-repository';

let authProviderInstance: IAuthProvider | null = null;
let userRepositoryInstance: IUserRepository | null = null;

export async function getAuthProvider(): Promise<IAuthProvider> {
  if (!authProviderInstance) {
    // Auto-initialize storage if needed (for API routes)
    const storage = await getStorage();
    authProviderInstance = new LocalAuthProvider(storage.users);
    console.log('[Auth] Initialized auth provider');
  }
  return authProviderInstance;
}

export function getUserRepository(): IUserRepository {
  if (!userRepositoryInstance) {
    const storage = getStorage();
    userRepositoryInstance = new InMemoryUserRepository(storage.users);
  }
  return userRepositoryInstance;
}

