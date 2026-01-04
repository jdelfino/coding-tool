/**
 * Singleton instance of authentication provider.
 * Used by API routes and server-side code.
 */

import { LocalAuthProvider } from './local-provider';
import { IAuthProvider, IUserRepository, INamespaceRepository } from './interfaces';
import { getStorage } from '../persistence';
import { InMemoryUserRepository } from './local';
import { LocalNamespaceRepository } from '../persistence/local/namespace-repository';

let authProviderInstance: IAuthProvider | null = null;
let userRepositoryInstance: IUserRepository | null = null;
let namespaceRepositoryInstance: INamespaceRepository | null = null;

export async function getAuthProvider(): Promise<IAuthProvider> {
  if (!authProviderInstance) {
    // Auto-initialize storage if needed (for API routes)
    const storage = await getStorage();
    authProviderInstance = new LocalAuthProvider(storage.users);
  }
  return authProviderInstance;
}

export function getUserRepository(): IUserRepository {
  if (!userRepositoryInstance) {
    userRepositoryInstance = new InMemoryUserRepository();
  }
  return userRepositoryInstance;
}

export async function getNamespaceRepository(): Promise<INamespaceRepository> {
  if (!namespaceRepositoryInstance) {
    const config = { type: 'local' as const, baseDir: process.env.DATA_DIR || './data' };
    namespaceRepositoryInstance = new LocalNamespaceRepository(config);
    await namespaceRepositoryInstance.initialize();
  }
  return namespaceRepositoryInstance;
}

