/**
 * Tests for storage factory function
 *
 * Verifies that the createStorage factory correctly instantiates
 * the appropriate storage backend based on configuration.
 */

import { createStorage, createDefaultStorage, StorageBackend, SupabaseStorageBackend } from '../index';
import { StorageConfig } from '../types';

describe('Storage Factory', () => {
  describe('createStorage', () => {
    it('should create local storage backend for type "local"', async () => {
      const config: StorageConfig = {
        type: 'local',
        baseDir: './test-data',
      };

      const storage = await createStorage(config);

      expect(storage).toBeInstanceOf(StorageBackend);
      expect(storage.sessions).toBeDefined();
      expect(storage.revisions).toBeDefined();
      expect(storage.users).toBeDefined();
      expect(storage.problems).toBeDefined();

      await storage.shutdown();
    });

    it('should create Supabase storage backend for type "supabase"', async () => {
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

        expect(storage).toBeInstanceOf(SupabaseStorageBackend);
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

    it('should default to local storage for unknown types', async () => {
      const config: StorageConfig = {
        type: 'memory', // Unsupported type
        baseDir: './test-data',
      };

      const storage = await createStorage(config);

      expect(storage).toBeInstanceOf(StorageBackend);

      await storage.shutdown();
    });

    it('should initialize all repositories', async () => {
      const config: StorageConfig = {
        type: 'local',
        baseDir: './test-data',
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
    it('should create local storage when Supabase env vars are not set', async () => {
      // Ensure Supabase env vars are not set
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.NEXT_PUBLIC_SUPABASE_URL;
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;

      try {
        const storage = await createDefaultStorage();
        expect(storage).toBeInstanceOf(StorageBackend);
        await storage.shutdown();
      } finally {
        // Restore environment variables
        if (originalUrl) {
          process.env.NEXT_PUBLIC_SUPABASE_URL = originalUrl;
        }
        if (originalKey) {
          process.env.SUPABASE_SERVICE_ROLE_KEY = originalKey;
        }
      }
    });

    it('should create Supabase storage when env vars are set', async () => {
      // Mock environment variables for Supabase
      const originalUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const originalKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

      process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
      process.env.SUPABASE_SERVICE_ROLE_KEY = 'test-service-key';

      try {
        const storage = await createDefaultStorage();
        expect(storage).toBeInstanceOf(SupabaseStorageBackend);
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
  });

  describe('StorageBackend', () => {
    it('should have all required repositories', () => {
      const config: StorageConfig = {
        type: 'local',
        baseDir: './test-data',
      };

      const storage = new StorageBackend(config);

      expect(storage.sessions).toBeDefined();
      expect(storage.revisions).toBeDefined();
      expect(storage.users).toBeDefined();
      expect(storage.problems).toBeDefined();
      expect(storage.classes).toBeDefined();
      expect(storage.sections).toBeDefined();
      expect(storage.memberships).toBeDefined();
    });

    it('should provide transaction support', async () => {
      const config: StorageConfig = {
        type: 'local',
        baseDir: './test-data',
      };

      const storage = new StorageBackend(config);
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

  describe('SupabaseStorageBackend', () => {
    it('should have all required repositories', () => {
      const storage = new SupabaseStorageBackend();

      expect(storage.sessions).toBeDefined();
      expect(storage.revisions).toBeDefined();
      expect(storage.users).toBeDefined();
      expect(storage.problems).toBeDefined();
      expect(storage.classes).toBeDefined();
      expect(storage.sections).toBeDefined();
      expect(storage.memberships).toBeDefined();
    });

    it('should provide transaction support', async () => {
      const storage = new SupabaseStorageBackend();

      const result = await storage.transaction(async (tx) => {
        expect(tx.sessions).toBe(storage.sessions);
        expect(tx.revisions).toBe(storage.revisions);
        expect(tx.users).toBe(storage.users);
        expect(tx.problems).toBe(storage.problems);
        expect(tx.classes).toBe(storage.classes);
        expect(tx.sections).toBe(storage.sections);
        expect(tx.memberships).toBe(storage.memberships);
        return 'success';
      });

      expect(result).toBe('success');
    });
  });
});
