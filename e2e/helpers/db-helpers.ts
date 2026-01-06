import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

/**
 * Path to the data directory
 */
const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Base URL for API calls
 */
const API_BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

/**
 * Supabase client for E2E tests (uses service role key for admin operations)
 */
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
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
 * Clears all test data by resetting data directory to empty state
 * Creates empty JSON files with empty objects/arrays
 *
 * Note: This clears files directly. The Next.js server needs to restart
 * or reload data to see these changes.
 */
export async function clearTestData(): Promise<void> {
  const dataFiles = [
    'users.json',
    'auth-sessions.json',
    'classes.json',
    'sections.json',
    'memberships.json',
    'sessions.json',
    'revisions.json',
    'namespaces.json'  // Add namespaces to clear
  ];

  for (const file of dataFiles) {
    const filePath = path.join(DATA_DIR, file);
    await fs.promises.writeFile(filePath, '{}', 'utf-8');
  }

  // Clear problems directory
  const problemsDir = path.join(DATA_DIR, 'problems');
  if (fs.existsSync(problemsDir)) {
    const files = await fs.promises.readdir(problemsDir);
    for (const file of files) {
      await fs.promises.unlink(path.join(problemsDir, file));
    }
  } else {
    await fs.promises.mkdir(problemsDir, { recursive: true });
  }

  // Create empty problem index
  const problemIndexPath = path.join(problemsDir, 'index.json');
  await fs.promises.writeFile(problemIndexPath, JSON.stringify({
    problems: [],
    lastModified: new Date().toISOString()
  }, null, 2), 'utf-8');
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
 * Read a JSON data file from the data directory
 * @deprecated Use Supabase client directly instead
 */
export async function readDataFile(filename: string): Promise<any> {
  const filePath = path.join(DATA_DIR, filename);
  try {
    const data = await fs.promises.readFile(filePath, 'utf-8');
    return JSON.parse(data, (key, value) => {
      // Revive Date objects
      if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
        return new Date(value);
      }
      return value;
    });
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      // File doesn't exist, return empty object
      return {};
    }
    throw error;
  }
}

/**
 * Write a JSON data file to the data directory
 */
export async function writeDataFile(filename: string, data: any): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Creates a test namespace via system admin API
 * Uses Supabase Auth to create a temporary admin user
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
    // Create a temporary system admin user
    const adminEmail = `temp-admin-${Date.now()}@test.local`;
    const adminPassword = 'temp-password-123';
    const adminId = `admin-${Date.now()}`;

    // 1. Create auth.users
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      id: adminId,
      email: adminEmail,
      password: adminPassword,
      email_confirm: true
    });

    if (authError) {
      throw new Error(`Failed to create admin auth user: ${authError.message}`);
    }

    // 2. Create user_profiles
    const { error: profileError } = await supabase.from('user_profiles').insert({
      id: adminId,
      username: `admin-${Date.now()}`,
      role: 'system-admin',
      namespace_id: null
    });

    if (profileError) {
      await supabase.auth.admin.deleteUser(adminId);
      throw new Error(`Failed to create admin profile: ${profileError.message}`);
    }

    // 3. Sign in to get session token
    const { data: sessionData, error: signInError } = await supabase.auth.signInWithPassword({
      email: adminEmail,
      password: adminPassword
    });

    if (signInError || !sessionData?.session) {
      await supabase.auth.admin.deleteUser(adminId);
      throw new Error(`Failed to sign in as admin: ${signInError?.message}`);
    }

    // 4. Create namespace via API
    const response = await fetch(`${API_BASE_URL}/api/system/namespaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sb-access-token=${sessionData.session.access_token}`
      },
      body: JSON.stringify({
        id: namespaceId,
        displayName: displayName || namespaceId
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create namespace: ${response.status} ${errorText}`);
    }

    console.log(`Created test namespace: ${namespaceId}`);

    // Clean up temporary admin user
    await supabase.auth.admin.deleteUser(adminId);
  } catch (error) {
    console.error(`Error creating namespace ${namespaceId}:`, error);
    throw error;
  }
}

/**
 * Cleans up a test namespace by deleting all users and associated data
 * Uses Supabase Admin API to delete auth.users (which cascades to user_profiles)
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
      return;
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

    // 3. Delete the namespace via API
    // First, create a temporary system admin session
    const adminEmail = 'cleanup-admin@test.local';
    const adminPassword = 'cleanup-password-123';
    const adminId = `cleanup-${Date.now()}`;

    // Create temporary admin user
    const { error: adminCreateError } = await supabase.auth.admin.createUser({
      id: adminId,
      email: adminEmail,
      password: adminPassword,
      email_confirm: true
    });

    if (!adminCreateError) {
      // Create admin profile
      await supabase.from('user_profiles').insert({
        id: adminId,
        username: 'cleanup-admin',
        role: 'system-admin',
        namespace_id: null
      });

      // Sign in as admin
      const { data: authData } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword
      });

      if (authData?.session) {
        // Delete namespace via API
        const response = await fetch(`${API_BASE_URL}/api/system/namespaces/${namespaceId}`, {
          method: 'DELETE',
          headers: {
            'Cookie': `sb-access-token=${authData.session.access_token}`
          }
        });

        if (!response.ok && response.status !== 404) {
          console.warn(`Warning: Failed to delete namespace ${namespaceId}: ${response.status}`);
        }
      }

      // Clean up admin user
      await supabase.auth.admin.deleteUser(adminId);
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
