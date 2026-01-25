import { createClient } from '@supabase/supabase-js';

/**
 * Check if Supabase credentials are available
 */
export function hasSupabaseCredentials(): boolean {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
}

/**
 * Supabase client for E2E tests (uses service role key for admin operations)
 * Returns null if Supabase credentials are not available
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseServiceKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseServiceKey) {
    console.warn('SUPABASE_SECRET_KEY not set - E2E tests require Supabase');
    throw new Error('SUPABASE_SECRET_KEY environment variable is required for E2E tests');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

/**
 * Clears orphaned test data from Supabase.
 *
 * IMPORTANT: This function is called before each test, but with parallel test
 * execution we can't delete data that other running tests might depend on.
 *
 * With namespace isolation:
 * - Each test creates a unique namespace (test-{timestamp}-{random})
 * - Each test cleans up its own namespace via cleanupNamespace()
 * - CASCADE deletes handle all related data (users, sessions, etc.)
 *
 * This function now only cleans up orphaned test users (users whose namespace
 * no longer exists), which is safe even with parallel tests.
 */
export async function clearTestData(): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // Get all namespaces that exist
    const { data: namespaces } = await supabase
      .from('namespaces')
      .select('id');
    const existingNamespaceIds = new Set(namespaces?.map(n => n.id) || []);

    // Only delete test users whose namespace no longer exists (orphaned users)
    // This is safe because if the namespace is gone, no test is using that user
    const { data: users, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
      console.warn('Failed to list users for cleanup:', listError.message);
      return;
    }

    // Find orphaned test users (users in namespaces that don't exist anymore)
    const orphanedUsers = users.users.filter(u => {
      if (!u.email?.endsWith('@test.local') && !u.email?.endsWith('@integration-test.local')) {
        return false; // Not a test user
      }
      // Check if user's namespace still exists by looking at user_profiles
      // For now, we skip deletion if we can't determine - safer for parallel tests
      return false; // Disabled for now - let cleanupNamespace handle everything
    });

    if (orphanedUsers.length > 0) {
      for (const user of orphanedUsers) {
        await supabase.auth.admin.deleteUser(user.id);
      }
      console.log(`Cleared ${orphanedUsers.length} orphaned test users`);
    }

    // NOTE: We do NOT delete sessions/session_students/revisions/users globally:
    // 1. Tests use namespace isolation - each test has its own namespace
    // 2. cleanupNamespace() handles all related data via CASCADE delete
    // 3. Deleting data globally breaks parallel tests that are still running

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
 * @param displayName - Display name for the user (also used to generate email)
 * @param role - User role (system-admin, namespace-admin, instructor, student)
 * @param namespaceId - Optional namespace ID (required for non-system-admin users)
 */
export async function createTestUser(
  userId: string,
  displayName: string,
  role: 'system-admin' | 'namespace-admin' | 'instructor' | 'student',
  namespaceId?: string
): Promise<void> {
  const supabase = getSupabaseClient();
  const email = getTestUserEmail(displayName);
  const password = getTestUserPassword();

  try {
    // 1. Create auth.users via Supabase Admin API
    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
      id: userId,
      email,
      password,
      email_confirm: true,  // Auto-confirm for tests
      user_metadata: { displayName }
    });

    if (authError) {
      throw new Error(`Failed to create auth user: ${authError.message}`);
    }

    // 2. Create user_profiles row
    const { error: profileError } = await supabase
      .from('user_profiles')
      .insert({
        id: userId,
        role,
        namespace_id: namespaceId || (role === 'system-admin' ? null : 'default'),
        display_name: displayName
      });

    if (profileError) {
      // Rollback: delete auth user
      await supabase.auth.admin.deleteUser(userId);
      throw new Error(`Failed to create user profile: ${profileError.message}`);
    }

    console.log(`Created test user: ${displayName} (${email}) with role ${role}`);
  } catch (error) {
    console.error(`Error creating test user ${displayName}:`, error);
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
 * Cleans up a test namespace by deleting it and all associated data.
 * Uses Supabase service role to delete directly (bypasses RLS).
 *
 * CASCADE deletes handle all related data automatically:
 * - user_profiles, classes, sections, problems, sessions, revisions
 * - session_students, section_memberships (via their parent cascades)
 *
 * Auth users must be deleted separately as they're in a different schema.
 *
 * @param namespaceId - The namespace ID to clean up
 */
export async function cleanupNamespace(namespaceId: string): Promise<void> {
  try {
    const supabase = getSupabaseClient();

    // 1. Get user IDs before deleting (needed for auth.users cleanup)
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('namespace_id', namespaceId);

    // 2. Delete namespace - CASCADE handles all related data in public schema
    const { error: deleteError } = await supabase
      .from('namespaces')
      .delete()
      .eq('id', namespaceId);

    if (deleteError) {
      console.warn(`Warning: Failed to delete namespace ${namespaceId}:`, deleteError);
    }

    // 3. Delete auth.users (separate schema, not handled by CASCADE)
    if (profiles && profiles.length > 0) {
      for (const profile of profiles) {
        const { error: userError } = await supabase.auth.admin.deleteUser(profile.id);
        if (userError) {
          console.warn(`Warning: Failed to delete auth user ${profile.id}:`, userError);
        }
      }
      console.log(`Cleaned up namespace ${namespaceId} with ${profiles.length} users`);
    } else {
      console.log(`Cleaned up namespace ${namespaceId}`);
    }
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
