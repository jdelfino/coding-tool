import { createClient } from '@supabase/supabase-js';

/**
 * Check if Supabase credentials are available
 */
export function hasSupabaseCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
}

/**
 * Supabase client for E2E tests (uses service role key for admin operations)
 * Returns null if Supabase credentials are not available
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set - E2E tests require Supabase');
    throw new Error('SUPABASE_SERVICE_ROLE_KEY environment variable is required for E2E tests');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Clears all test data from Supabase
 * Deletes test users (identified by @test.local email suffix) which
 * cascades to user_profiles and other related data.
 */
export async function clearTestData(): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // Delete all test users (identified by @test.local email)
    // This cascades to user_profiles and related data
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.warn('Failed to list users for cleanup:', listError.message);
      return;
    }

    // Delete test users
    const testUsers = users.users.filter(u =>
      u.email?.endsWith('@test.local') ||
      u.email?.endsWith('@integration-test.local')
    );

    for (const user of testUsers) {
      await supabase.auth.admin.deleteUser(user.id);
    }

    if (testUsers.length > 0) {
      console.log(`Cleared ${testUsers.length} test users`);
    }

    // Clear sessions and session_students (test data that might be left over)
    await supabase.from('session_students').delete().neq('session_id', '');
    await supabase.from('sessions').delete().neq('id', '');
    await supabase.from('revisions').delete().neq('session_id', '');

    // Note: We don't delete namespaces here as they may be needed for tests
    // Test namespaces are cleaned up by cleanupNamespace() after each test

  } catch (error) {
    console.warn('Error clearing test data:', error);
    // Don't throw - cleanup failures shouldn't fail test setup
  }
}

/**
 * Resets data directory to a known good state for testing
 */
export async function resetTestData(): Promise<void> {
  await clearTestData();
}

/**
 * Creates a test user via the Supabase Admin API
 * This creates both auth.users and user_profiles rows
 *
 * @param userId - Unique identifier for the user
 * @param username - Username for the user
 * @param role - User role (system-admin, namespace-admin, instructor, student)
 * @param namespaceId - Optional namespace ID (required for non-system-admin users)
 */
export async function createTestUser(
  userId: string,
  username: string,
  role: 'system-admin' | 'namespace-admin' | 'instructor' | 'student',
  namespaceId?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const email = getTestUserEmail(username);
  const password = getTestUserPassword();

  try {
    // 1. Create auth.users via Supabase Admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      id: userId,
      email,
      password,
      email_confirm: true,  // Auto-confirm for tests
      user_metadata: { username }
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    // 2. Create user_profiles row
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        username,
        role,
        namespace_id: namespaceId || (role === 'system-admin' ? null : 'default'),
        display_name: username
      });

    if (profileError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    console.log(`Created test user: ${username} (${email}) with role ${role}`);
  } catch (error) {
    console.error(`Error creating test user ${username}:`, error);
    throw error;
  }
}

/**
 * Get test user email from username
 */
export function getTestUserEmail(username: string): string {
  return `${username}@test.local`;
}

/**
 * Get standard test password for all test users
 */
export function getTestUserPassword(): string {
  return 'testpassword123';
}

/**
 * Creates a test namespace directly via Supabase
 * Uses service role key to bypass RLS and create directly
 *
 * @param namespaceId - Unique identifier for the namespace (e.g., 'test-123')
 * @param displayName - Optional display name (defaults to namespaceId)
 * @returns Promise that resolves when namespace is created
 */
export async function createTestNamespace(
  namespaceId: string,
  displayName?: string
): Promise<void> {
  const supabase = getSupabaseClient();

  try {
    // Create namespace directly via Supabase (service role bypasses RLS)
    const { error } = await supabase.from('namespaces').insert({
      id: namespaceId,
      display_name: displayName || namespaceId,
      active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    });

    if (error) {
      throw new Error(`Failed to create namespace: ${error.message}`);
    }

    console.log(`Created test namespace: ${namespaceId}`);
  } catch (error) {
    console.error(`Error creating namespace ${namespaceId}:`, error);
    throw error;
  }
}

/**
 * Cleans up a test namespace by deleting all users and associated data
 * Uses Supabase service role to delete directly (bypasses RLS)
 *
 * @param namespaceId - The namespace ID to clean up
 */
export async function cleanupNamespace(namespaceId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // 1. Get all user_profiles in this namespace
    const { data: profiles, error: profileError } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('namespace_id', namespaceId);

    if (profileError) {
      console.warn(`Warning: Failed to query user_profiles for namespace ${namespaceId}:`, profileError);
    }

    // 2. Delete auth.users (CASCADE will delete user_profiles)
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        const { error: deleteError } = await supabase.auth.admin.deleteUser(profile.id);
        if (deleteError) {
          console.warn(`Warning: Failed to delete user ${profile.id}:`, deleteError);
        }
      }
      console.log(`Cleaned up ${profiles.length} users from namespace ${namespaceId}`);
    }

    // 3. Delete the namespace directly via Supabase (service role bypasses RLS)
    const { error: deleteError } = await supabase
      .from('namespaces')
      .delete()
      .eq('id', namespaceId);

    if (deleteError) {
      console.warn(`Warning: Failed to delete namespace ${namespaceId}:`, deleteError);
    }

    console.log(`Cleaned up test namespace: ${namespaceId}`);
  } catch (error) {
    console.warn(`Warning: Error cleaning up namespace ${namespaceId}:`, error);
    // Don't throw - cleanup failures shouldn't fail tests
  }
}

/**
 * Generates a unique namespace ID for test isolation
 * Format: test-{timestamp}-{random}
 */
export function generateTestNamespaceId(): string {
  return `test-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
