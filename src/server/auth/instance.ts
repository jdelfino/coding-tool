/**
 * Singleton instance of authentication provider.
 * Used by API routes and server-side code.
 */

import { IAuthProvider, IUserRepository, INamespaceRepository } from './interfaces';
import { SupabaseAuthProvider } from './supabase-provider';
import { getStorage } from '../persistence';
import { SupabaseNamespaceRepository } from '../persistence/supabase/namespace-repository';

let authProviderInstance: IAuthProvider | null = null;
let userRepositoryInstance: IUserRepository | null = null;
let namespaceRepositoryInstance: INamespaceRepository | null = null;

export async function getAuthProvider(): Promise<IAuthProvider> {
  if (!authProviderInstance) {
    authProviderInstance = new SupabaseAuthProvider();
    await authProviderInstance.userRepository.initialize?.();
  }
  return authProviderInstance;
}

export async function getUserRepository(): Promise<IUserRepository> {
  if (!userRepositoryInstance) {
    // Use the same repository as the storage backend
    const storage = await getStorage();
    userRepositoryInstance = storage.users;
  }
  return userRepositoryInstance;
}

export async function getNamespaceRepository(): Promise<INamespaceRepository> {
  if (!namespaceRepositoryInstance) {
    namespaceRepositoryInstance = new SupabaseNamespaceRepository();
    await namespaceRepositoryInstance.initialize?.();
  }
  return namespaceRepositoryInstance;
}

