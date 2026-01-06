/**
 * Singleton instance of authentication provider.
 * Used by API routes and server-side code.
 */

import { IAuthProvider, IUserRepository, INamespaceRepository } from './interfaces';
import { getStorage } from '../persistence';
import { SupabaseNamespaceRepository } from '../persistence/supabase/namespace-repository';

let authProviderInstance: IAuthProvider | null = null;
let userRepositoryInstance: IUserRepository | null = null;
let namespaceRepositoryInstance: INamespaceRepository | null = null;

export async function getAuthProvider(): Promise<IAuthProvider> {
  if (!authProviderInstance) {
    // TODO: Implement Supabase auth provider as part of coding-tool-aw4 epic
    // For now, return a placeholder that throws errors
    throw new Error('Auth provider not yet migrated to Supabase - see coding-tool-aw4');
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

