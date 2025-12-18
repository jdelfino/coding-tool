/**
 * Singleton instance of authentication provider.
 * Used by API routes and server-side code.
 */

import { LocalAuthProvider } from './local-provider';
import { InMemoryUserRepository } from './user-repository';
import { IAuthProvider } from './interfaces';

let authProviderInstance: IAuthProvider | null = null;

export function getAuthProvider(): IAuthProvider {
  if (!authProviderInstance) {
    const userRepository = new InMemoryUserRepository();
    authProviderInstance = new LocalAuthProvider(userRepository);
  }
  return authProviderInstance;
}
