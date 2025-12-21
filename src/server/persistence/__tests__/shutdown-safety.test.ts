/**
 * Tests for safe shutdown of repositories
 * 
 * Regression tests for bug where calling shutdown() before initialization
 * or multiple times would throw "Repository not initialized" errors.
 */

import { LocalUserRepository } from '../local/user-repository';
import { LocalSessionRepository } from '../local/session-repository';
import { LocalRevisionRepository } from '../local/revision-repository';
import * as path from 'path';

describe('Repository Shutdown Safety', () => {
  const testDir = path.join(__dirname, 'test-shutdown-safety');
  const config = { type: 'local' as const, baseDir: testDir };

  describe('User Repository', () => {
    it('should handle shutdown before initialization without throwing', async () => {
      // Bug: shutdown() called flush() which threw if !initialized
      const repo = new LocalUserRepository(config);
      
      // Should not throw even though not initialized
      await expect(repo.shutdown()).resolves.not.toThrow();
    });

    it('should handle multiple shutdown calls', async () => {
      const repo = new LocalUserRepository(config);
      await repo.initialize();
      
      // First shutdown
      await expect(repo.shutdown()).resolves.not.toThrow();
      
      // Second shutdown should also not throw
      await expect(repo.shutdown()).resolves.not.toThrow();
    });

    it('should handle shutdown after initialization', async () => {
      const repo = new LocalUserRepository(config);
      await repo.initialize();
      
      // Normal shutdown after use
      await expect(repo.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Session Repository', () => {
    it('should handle shutdown before initialization without throwing', async () => {
      const repo = new LocalSessionRepository(config);
      
      await expect(repo.shutdown()).resolves.not.toThrow();
    });

    it('should handle multiple shutdown calls', async () => {
      const repo = new LocalSessionRepository(config);
      await repo.initialize();
      
      await expect(repo.shutdown()).resolves.not.toThrow();
      await expect(repo.shutdown()).resolves.not.toThrow();
    });

    it('should handle shutdown after initialization', async () => {
      const repo = new LocalSessionRepository(config);
      await repo.initialize();
      
      await expect(repo.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Revision Repository', () => {
    it('should handle shutdown before initialization without throwing', async () => {
      const repo = new LocalRevisionRepository(config);
      
      await expect(repo.shutdown()).resolves.not.toThrow();
    });

    it('should handle multiple shutdown calls', async () => {
      const repo = new LocalRevisionRepository(config);
      await repo.initialize();
      
      await expect(repo.shutdown()).resolves.not.toThrow();
      await expect(repo.shutdown()).resolves.not.toThrow();
    });

    it('should handle shutdown after initialization', async () => {
      const repo = new LocalRevisionRepository(config);
      await repo.initialize();
      
      await expect(repo.shutdown()).resolves.not.toThrow();
    });
  });

  describe('Regression: Server shutdown scenario', () => {
    it('should handle shutdown sequence without errors', async () => {
      // Simulate the actual server shutdown sequence
      const userRepo = new LocalUserRepository(config);
      const sessionRepo = new LocalSessionRepository(config);
      const revisionRepo = new LocalRevisionRepository(config);

      await userRepo.initialize();
      await sessionRepo.initialize();
      await revisionRepo.initialize();

      // Shutdown all repositories (as done in server index.ts)
      await expect(Promise.all([
        userRepo.shutdown(),
        sessionRepo.shutdown(),
        revisionRepo.shutdown(),
      ])).resolves.not.toThrow();
    });

    it('should handle partial initialization during shutdown', async () => {
      // Scenario: Some repos initialized, some not, then shutdown called
      const userRepo = new LocalUserRepository(config);
      const sessionRepo = new LocalSessionRepository(config);
      const revisionRepo = new LocalRevisionRepository(config);

      // Only initialize some
      await userRepo.initialize();
      // sessionRepo not initialized
      await revisionRepo.initialize();

      // Shutdown all - should not throw for uninitialized ones
      await expect(Promise.all([
        userRepo.shutdown(),
        sessionRepo.shutdown(), // This one was never initialized
        revisionRepo.shutdown(),
      ])).resolves.not.toThrow();
    });
  });
});
