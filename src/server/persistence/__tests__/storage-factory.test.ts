/**
 * Tests for storage factory function
 *
 * Verifies that the createStorage factory correctly instantiates
 * the Supabase storage backend.
 */

import { createStorage, createDefaultStorage, StorageBackend } from '../index';
import { StorageConfig } from '../types';

describe('Storage Factory', () => {
  describe('createStorage', () => {
    it('should create Supabase storage backend', async () => {
      // Mock environment variables for Supabase
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

      try {
        const config: StorageConfig = {
          type: 'supabase',
        };

        const storage = await createStorage(config);

        expect(storage).toBeInstanceOf(StorageBackend);
        expect(storage.sessions).toBeDefined();
        expect(storage.revisions).toBeDefined();
        expect(storage.users).toBeDefined();
        expect(storage.problems).toBeDefined();
        expect(storage.classes).toBeDefined();
        expect(storage.sections).toBeDefined();
        expect(storage.memberships).toBeDefined();

        await storage.shutdown();
      } finally {
        // Restore environment variables
        if (originalUrl) {
          process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        } else {
          delete process.env.NEXT_PUBLIC_SUPABASE_URL;
        }
        if (originalKey) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
        } else {
          delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        }
      }
    });

    it('should initialize all repositories', async () => {
      const config: StorageConfig = {
        type: 'supabase',
      };

      const storage = await createStorage(config);

      // Verify that repositories are ready to use
      expect(storage.sessions).toBeDefined();
      expect(storage.revisions).toBeDefined();
      expect(storage.users).toBeDefined();
      expect(storage.problems).toBeDefined();

      // Verify health check works
      const health = await storage.health();
      expect(typeof health).toBe('boolean');

      await storage.shutdown();
    });
  });

  describe('createDefaultStorage', () => {
    it('should create Supabase storage', async () => {
      const storage = await createDefaultStorage();
      expect(storage).toBeInstanceOf(StorageBackend);
      await storage.shutdown();
    });
  });

  describe('StorageBackend', () => {
    it('should have all required repositories', () => {
      const storage = new StorageBackend();

      expect(storage.sessions).toBeDefined();
      expect(storage.revisions).toBeDefined();
      expect(storage.users).toBeDefined();
      expect(storage.problems).toBeDefined();
      expect(storage.classes).toBeDefined();
      expect(storage.sections).toBeDefined();
      expect(storage.memberships).toBeDefined();
    });

    it('should provide transaction support', async () => {
      const storage = new StorageBackend();
      await storage.initialize();

      const result = await storage.transaction(async (tx) => {
        expect(tx.sessions).toBe(storage.sessions);
        expect(tx.revisions).toBe(storage.revisions);
        expect(tx.users).toBe(storage.users);
        expect(tx.problems).toBe(storage.problems);
        return 'success';
      });

      expect(result).toBe('success');

      await storage.shutdown();
    });
  });
});
