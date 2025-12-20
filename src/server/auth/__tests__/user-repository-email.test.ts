/**
 * Unit tests for getUserByEmail method in UserRepository
 */

import { FakeUserRepository } from '../../__tests__/test-utils/fake-storage';

describe('FakeUserRepository - getUserByEmail', () => {
  let repository: FakeUserRepository;

  beforeEach(() => {
    repository = new FakeUserRepository();
  });

  it('should get user by email', async () => {
    // Create a user
    const user = await repository.createUser({
      username: 'alice@example.com',
      role: 'instructor',
    });

    // Get by email
    const found = await repository.getUserByEmail('alice@example.com');

    expect(found).toBeDefined();
    expect(found!.id).toBe(user.id);
    expect(found!.username).toBe('alice@example.com');
    expect(found!.role).toBe('instructor');
  });

  it('should be case-insensitive', async () => {
    const user = await repository.createUser({
      username: 'alice@example.com',
      role: 'instructor',
    });

    const found = await repository.getUserByEmail('ALICE@EXAMPLE.COM');
    expect(found).toBeDefined();
    expect(found!.id).toBe(user.id);
  });

  it('should return null if user not found', async () => {
    const found = await repository.getUserByEmail('nonexistent@example.com');
    expect(found).toBeNull();
  });

  it('should work same as getUserByUsername', async () => {
    const user = await repository.createUser({
      username: 'bob@example.com',
      role: 'student',
    });

    const byEmail = await repository.getUserByEmail('bob@example.com');
    const byUsername = await repository.getUserByUsername('bob@example.com');

    expect(byEmail).toEqual(byUsername);
  });
});
