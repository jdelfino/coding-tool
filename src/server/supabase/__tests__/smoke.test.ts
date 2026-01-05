/**
 * Smoke tests for Supabase connection
 *
 * These tests verify that the Supabase client can connect to the
 * local Supabase instance and perform basic operations.
 *
 * IMPORTANT: These tests require a running local Supabase instance.
 * Run `npx supabase start` before running these tests.
 */

import { createClient } from '@supabase/supabase-js';
import { Database } from '../types';

// Skip tests if Supabase is not running
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Check if we can run integration tests
const canRunIntegrationTests = SUPABASE_SERVICE_KEY.length > 0;

describe('Supabase Smoke Tests', () => {
  // Service role client (bypasses RLS)
  let serviceClient: ReturnType<typeof createClient<Database>>;

  beforeAll(() => {
    if (canRunIntegrationTests) {
      serviceClient = createClient<Database>(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      });
    }
  });

  describe('Connection Tests', () => {
    it('should connect to Supabase with service role key', async () => {
      if (!canRunIntegrationTests) {
        console.log('Skipping: SUPABASE_SERVICE_ROLE_KEY not set');
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
        console.log('Skipping: SUPABASE_SERVICE_ROLE_KEY not set');
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
        console.log('Skipping: SUPABASE_SERVICE_ROLE_KEY not set');
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
        console.log('Skipping: SUPABASE_SERVICE_ROLE_KEY not set');
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
        console.log('Skipping: SUPABASE_SERVICE_ROLE_KEY not set');
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
        console.log('Skipping: SUPABASE_SERVICE_ROLE_KEY not set');
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
    it('should block anonymous access (anon key) to namespaces', async () => {
      if (!SUPABASE_ANON_KEY) {
        console.log('Skipping: NEXT_PUBLIC_SUPABASE_ANON_KEY not set');
        return;
      }

      const anonClient = createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
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

    it('should allow service role to bypass RLS', async () => {
      if (!canRunIntegrationTests) {
        console.log('Skipping: SUPABASE_SERVICE_ROLE_KEY not set');
        return;
      }

      // Service role should see all namespaces
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
        console.log('Skipping: SUPABASE_SERVICE_ROLE_KEY not set');
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
        console.log('Skipping: SUPABASE_SERVICE_ROLE_KEY not set');
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
        console.log('Skipping: SUPABASE_SERVICE_ROLE_KEY not set');
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
});
