/**
 * Smoke tests for Supabase connection
 *
 * These tests verify that the Supabase client can connect to both
 * local and remote Supabase instances and perform basic operations.
 *
 * LOCAL TESTS (default):
 * Run `npx supabase start` before running these tests.
 *
 * REMOTE TESTS:
 * 1. Set NEXT_PUBLIC_SUPABASE_URL to your remote Supabase URL
 * 2. Set NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY
 * 3. Run: TEST_REMOTE_SUPABASE=true npm test -- smoke
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types';

// Determine which environment we're testing
const isRemoteTest = process.env.TEST_REMOTE_SUPABASE === 'true';

// Supabase configuration - uses same env vars for both local and remote
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SECRET_KEY = process.env.SUPABASE_SECRET_KEY || '';
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Check if we can run integration tests
const canRunIntegrationTests = SUPABASE_SECRET_KEY.length > 0 && SUPABASE_URL.length > 0;

const testLabel = isRemoteTest ? 'Remote Supabase' : 'Local Supabase';
const skipMessage = 'Skipping tests: SUPABASE_SECRET_KEY not set';

describe(`Supabase Smoke Tests (${testLabel})`, () => {
  // Service role client (bypasses RLS)
  let serviceClient: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    if (canRunIntegrationTests) {
      serviceClient = createClient<Database>(SUPABASE_URL, SUPABASE_SECRET_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  });

  describe('Connection Tests', () => {
    it(`should connect to ${testLabel} with secret key`, async () => {
      if (!canRunIntegrationTests) {
        console.log(skipMessage);
        return;
      }

      // Simple health check - query the namespaces table
      const { data, error } = await serviceClient
        .from('namespaces')
        .select('id')
        .limit(1);

      expect(error).toBeNull();
      expect(data).toBeDefined();
    });

    it('should find seed data in namespaces table', async () => {
      if (!canRunIntegrationTests) {
        console.log(skipMessage);
        return;
      }

      const { data, error } = await serviceClient
        .from('namespaces')
        .select('*')
        .eq('id', 'test-school')
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.id).toBe('test-school');
      expect(data?.display_name).toBe('Test School');
      expect(data?.active).toBe(true);
    });

    it('should find seed data in user_profiles table', async () => {
      if (!canRunIntegrationTests) {
        console.log(skipMessage);
        return;
      }

      const { data, error } = await serviceClient
        .from('user_profiles')
        .select('*')
        .order('username');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(4);

      // Verify the seed users exist
      const usernames = data?.map(u => u.username) || [];
      expect(usernames).toContain('admin');
      expect(usernames).toContain('instructor');
      expect(usernames).toContain('alice');
      expect(usernames).toContain('bob');
    });

    it('should find seed data in classes table', async () => {
      if (!canRunIntegrationTests) {
        console.log(skipMessage);
        return;
      }

      const { data, error } = await serviceClient
        .from('classes')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(1);
      expect(data?.[0]?.name).toContain('CS 101');
    });

    it('should find seed data in sections table', async () => {
      if (!canRunIntegrationTests) {
        console.log(skipMessage);
        return;
      }

      const { data, error } = await serviceClient
        .from('sections')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(1);
      expect(data?.[0]?.join_code).toBe('ABC-123-XYZ');
    });

    it('should find seed data in problems table', async () => {
      if (!canRunIntegrationTests) {
        console.log(skipMessage);
        return;
      }

      const { data, error } = await serviceClient
        .from('problems')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data?.length).toBeGreaterThanOrEqual(1);

      const titles = data?.map(p => p.title) || [];
      expect(titles).toContain('Hello World');
    });
  });

  describe('RLS Policy Tests', () => {
    it('should block anonymous access (publishable key) to namespaces', async () => {
      if (!SUPABASE_PUBLISHABLE_KEY) {
        console.log('Skipping: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set');
        return;
      }

      const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });

      const { data, error } = await anonClient
        .from('namespaces')
        .select('*');

      // With RLS, anonymous users should see an empty array (not an error)
      expect(error).toBeNull();
      expect(data).toEqual([]);
    });

    it('should allow secret key to bypass RLS', async () => {
      if (!canRunIntegrationTests) {
        console.log(skipMessage);
        return;
      }

      // Secret key should see all namespaces
      const { data, error } = await serviceClient
        .from('namespaces')
        .select('*');

      expect(error).toBeNull();
      expect(data).toBeDefined();
      expect(data!.length).toBeGreaterThan(0);
    });
  });

  describe('CRUD Operations', () => {
    const testNamespaceId = 'test-crud-namespace';

    afterEach(async () => {
      if (canRunIntegrationTests) {
        // Clean up test data
        await serviceClient
          .from('namespaces')
          .delete()
          .eq('id', testNamespaceId);
      }
    });

    it('should create and read a namespace', async () => {
      if (!canRunIntegrationTests) {
        console.log(skipMessage);
        return;
      }

      // Create
      const { error: insertError } = await serviceClient
        .from('namespaces')
        .insert({
          id: testNamespaceId,
          display_name: 'Test CRUD Namespace',
          active: true,
        });

      expect(insertError).toBeNull();

      // Read
      const { data, error: selectError } = await serviceClient
        .from('namespaces')
        .select('*')
        .eq('id', testNamespaceId)
        .single();

      expect(selectError).toBeNull();
      expect(data?.id).toBe(testNamespaceId);
      expect(data?.display_name).toBe('Test CRUD Namespace');
    });

    it('should update a namespace', async () => {
      if (!canRunIntegrationTests) {
        console.log(skipMessage);
        return;
      }

      // Create first
      await serviceClient
        .from('namespaces')
        .insert({
          id: testNamespaceId,
          display_name: 'Original Name',
          active: true,
        });

      // Update
      const { error: updateError } = await serviceClient
        .from('namespaces')
        .update({ display_name: 'Updated Name' })
        .eq('id', testNamespaceId);

      expect(updateError).toBeNull();

      // Verify
      const { data } = await serviceClient
        .from('namespaces')
        .select('*')
        .eq('id', testNamespaceId)
        .single();

      expect(data?.display_name).toBe('Updated Name');
    });

    it('should delete a namespace', async () => {
      if (!canRunIntegrationTests) {
        console.log(skipMessage);
        return;
      }

      // Create first
      await serviceClient
        .from('namespaces')
        .insert({
          id: testNamespaceId,
          display_name: 'To Delete',
          active: true,
        });

      // Delete
      const { error: deleteError } = await serviceClient
        .from('namespaces')
        .delete()
        .eq('id', testNamespaceId);

      expect(deleteError).toBeNull();

      // Verify deleted
      const { data } = await serviceClient
        .from('namespaces')
        .select('*')
        .eq('id', testNamespaceId)
        .single();

      expect(data).toBeNull();
    });
  });

  // Remote-specific tests
  if (isRemoteTest) {
    describe('Remote Environment Validation', () => {
      it('should validate URL is a hosted Supabase instance', async () => {
        if (!canRunIntegrationTests) {
          console.log(skipMessage);
          return;
        }

        // Verify not pointing to localhost
        expect(SUPABASE_URL).not.toContain('localhost');
        expect(SUPABASE_URL).not.toContain('127.0.0.1');

        // Verify it's a valid HTTPS URL (not local HTTP)
        expect(SUPABASE_URL).toMatch(/^https:\/\//);

        // Verify it contains supabase.co domain
        expect(SUPABASE_URL).toContain('supabase.co');
      });

      it('should have reasonable response times (< 2s)', async () => {
        if (!canRunIntegrationTests) {
          console.log(skipMessage);
          return;
        }

        const startTime = Date.now();

        const { error } = await serviceClient
          .from('namespaces')
          .select('id')
          .limit(1);

        const duration = Date.now() - startTime;

        expect(error).toBeNull();
        expect(duration).toBeLessThan(2000);
        console.log(`Remote query took ${duration}ms`);
      });

      it('should handle CORS correctly for browser clients', async () => {
        if (!SUPABASE_PUBLISHABLE_KEY) {
          console.log('Skipping: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set');
          return;
        }

        // Create a browser-like client (publishable key)
        const browserClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        // Should be able to query (even if RLS blocks results)
        const { error } = await browserClient
          .from('namespaces')
          .select('id')
          .limit(1);

        // No CORS error - either success (null error) or RLS block (both are OK)
        // If there's an error, it should not be a CORS error
        if (error) {
          expect(error.message).not.toMatch(/CORS|cross-origin/i);
        } else {
          // No error means CORS is working fine
          expect(error).toBeNull();
        }
      });
    });

    describe('Migration Status', () => {
      it('should have all expected tables', async () => {
        if (!canRunIntegrationTests) {
          console.log(skipMessage);
          return;
        }

        const expectedTables = [
          'namespaces',
          'user_profiles',
          'classes',
          'sections',
          'section_memberships',
          'problems',
          'sessions',
          'session_students',
          'revisions',
        ];

        // Query information_schema to check table existence
        for (const tableName of expectedTables) {
          const { data, error } = await serviceClient
            .from(tableName as any)
            .select('*')
            .limit(0);

          expect(error).toBeNull();
          expect(data).toBeDefined();
        }
      });

      it('should have correct RLS policies enabled', async () => {
        if (!canRunIntegrationTests) {
          console.log(skipMessage);
          return;
        }

        // Test that RLS is enforced by checking with publishable key
        if (!SUPABASE_PUBLISHABLE_KEY) {
          console.log('Skipping RLS check: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY not set');
          return;
        }

        const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
          auth: {
            autoRefreshToken: false,
            persistSession: false,
          },
        });

        // Anon should not see any data (RLS blocks)
        const { data } = await anonClient
          .from('namespaces')
          .select('*');

        expect(data).toEqual([]);
      });
    });

    describe('Performance Characteristics', () => {
      it('should handle batch operations efficiently', async () => {
        if (!canRunIntegrationTests) {
          console.log(skipMessage);
          return;
        }

        const testIds = Array.from({ length: 5 }, (_, i) => `perf-test-${i}`);

        // Cleanup any existing test data
        await serviceClient
          .from('namespaces')
          .delete()
          .in('id', testIds);

        const startTime = Date.now();

        // Batch insert
        const { error: insertError } = await serviceClient
          .from('namespaces')
          .insert(
            testIds.map(id => ({
              id,
              display_name: `Perf Test ${id}`,
              active: true,
            }))
          );

        expect(insertError).toBeNull();

        // Batch query
        const { data, error: selectError } = await serviceClient
          .from('namespaces')
          .select('*')
          .in('id', testIds);

        expect(selectError).toBeNull();
        expect(data?.length).toBe(5);

        // Batch delete
        const { error: deleteError } = await serviceClient
          .from('namespaces')
          .delete()
          .in('id', testIds);

        expect(deleteError).toBeNull();

        const duration = Date.now() - startTime;
        expect(duration).toBeLessThan(3000); // Batch operations < 3s
        console.log(`Batch operations (5 records) took ${duration}ms`);
      });
    });
  }
});
