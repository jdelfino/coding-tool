import * as fs from 'fs';
import * as path from 'path';

/**
 * Path to the data directory
 */
const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Base URL for API calls
 */
const API_BASE_URL = process.env.PLAYWRIGHT_TEST_BASE_URL || 'http://localhost:3000';

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
 * Creates a test user via the authentication API
 * This ensures the user is properly loaded into the in-memory repository
 *
 * For system-admin users, this directly creates them in the users.json file
 * since they can't be created through the normal signin flow without env var.
 * 
 * For other users with a specific namespace, uses the system admin API to create them.
 * For other users without namespace specified, uses the signin endpoint which auto-creates users in 'default' namespace.
 */
export async function createTestUser(
  userId: string,
  username: string,
  role: 'system-admin' | 'namespace-admin' | 'instructor' | 'student',
  namespaceId?: string
): Promise<void> {
  try {
    // For system-admin, we need to create them directly in the database
    // since the signin flow requires SYSTEM_ADMIN_EMAIL env var
    if (role === 'system-admin') {
      const usersFile = path.join(DATA_DIR, 'users.json');
      const users = await readDataFile('users.json');

      users[userId] = {
        id: userId,
        username,
        role: 'system-admin',
        namespaceId: null,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      await writeDataFile('users.json', users);
      return;
    }

    // If namespace is specified, create user via system admin API
    if (namespaceId) {
      // First, create a temporary system admin to make the API call
      const adminUsername = `temp-admin-${Date.now()}`;
      const adminUserId = `admin-${Date.now()}`;
      
      const usersFile = path.join(DATA_DIR, 'users.json');
      const users = await readDataFile('users.json');

      users[adminUserId] = {
        id: adminUserId,
        username: adminUsername,
        role: 'system-admin',
        namespaceId: null,
        createdAt: new Date().toISOString(),
        lastLoginAt: new Date().toISOString(),
      };

      await writeDataFile('users.json', users);

      // Create auth session for the admin
      const sessionId = `session-${Date.now()}`;
      const sessions = await readDataFile('auth-sessions.json');

      sessions[sessionId] = {
        id: sessionId,
        userId: adminUserId,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      };

      await writeDataFile('auth-sessions.json', sessions);

      // Create user in namespace via system admin API
      const response = await fetch(`${API_BASE_URL}/api/system/namespaces/${namespaceId}/users`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Cookie': `sessionId=${sessionId}`
        },
        body: JSON.stringify({ username, role }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Failed to create test user in namespace: ${response.status} ${errorText}`);
      }
      return;
    }

    // For other roles without namespace, use the signin endpoint which auto-creates users
    const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Failed to create test user: ${response.status} ${errorText}`);
    }
  } catch (error) {
    console.error(`Error creating test user ${username}:`, error);
    throw error;
  }
}

/**
 * Creates a test auth session for a user
 * This is done automatically by the signin endpoint, so this function
 * just calls signin to create both user and session
 */
export async function createTestAuthSession(sessionId: string, userId: string): Promise<void> {
  // Auth sessions are created automatically via signin
  // This is a no-op for backward compatibility
  console.log(`Note: Auth sessions are now created automatically via signin. SessionId param ignored.`);
}

/**
 * Read a JSON data file from the data directory
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
 * 
 * @param namespaceId - Unique identifier for the namespace (e.g., 'test-123')
 * @param displayName - Optional display name (defaults to namespaceId)
 * @returns Promise that resolves when namespace is created
 */
export async function createTestNamespace(
  namespaceId: string,
  displayName?: string
): Promise<void> {
  // First, create a system admin user to make the API call
  const adminUsername = `system-admin-${Date.now()}`;
  const adminUserId = `admin-${Date.now()}`;
  
  // Create system admin directly in database
  const usersFile = path.join(DATA_DIR, 'users.json');
  const users = await readDataFile('users.json');

  users[adminUserId] = {
    id: adminUserId,
    username: adminUsername,
    role: 'system-admin',
    namespaceId: null,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString(),
  };

  await writeDataFile('users.json', users);

  // Create auth session for the admin
  const sessionId = `session-${Date.now()}`;
  const sessionsFile = path.join(DATA_DIR, 'auth-sessions.json');
  const sessions = await readDataFile('auth-sessions.json');

  sessions[sessionId] = {
    id: sessionId,
    userId: adminUserId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // 24 hours
  };

  await writeDataFile('auth-sessions.json', sessions);

  // Now create the namespace via API
  try {
    const response = await fetch(`${API_BASE_URL}/api/system/namespaces`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Cookie': `sessionId=${sessionId}`
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
  } catch (error) {
    console.error(`Error creating namespace ${namespaceId}:`, error);
    throw error;
  }
}

/**
 * Cleans up a test namespace by deleting it via system admin API
 * This also deletes all associated data (users, classes, sections, sessions, etc.)
 * 
 * @param namespaceId - The namespace ID to delete
 */
export async function cleanupNamespace(namespaceId: string): Promise<void> {
  try {
    // Create a temporary system admin session for cleanup
    const adminUsername = `cleanup-admin-${Date.now()}`;
    const adminUserId = `admin-${Date.now()}`;
    
    // Create system admin directly in database
    const usersFile = path.join(DATA_DIR, 'users.json');
    const users = await readDataFile('users.json');

    users[adminUserId] = {
      id: adminUserId,
      username: adminUsername,
      role: 'system-admin',
      namespaceId: null,
      createdAt: new Date().toISOString(),
      lastLoginAt: new Date().toISOString(),
    };

    await writeDataFile('users.json', users);

    // Create auth session for the admin
    const sessionId = `session-${Date.now()}`;
    const sessionsFile = path.join(DATA_DIR, 'auth-sessions.json');
    const sessions = await readDataFile('auth-sessions.json');

    sessions[sessionId] = {
      id: sessionId,
      userId: adminUserId,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
    };

    await writeDataFile('auth-sessions.json', sessions);

    // Delete the namespace via API
    const response = await fetch(`${API_BASE_URL}/api/system/namespaces/${namespaceId}`, {
      method: 'DELETE',
      headers: {
        'Cookie': `sessionId=${sessionId}`
      },
    });

    if (!response.ok && response.status !== 404) {
      const errorText = await response.text();
      console.warn(`Warning: Failed to delete namespace ${namespaceId}: ${response.status} ${errorText}`);
    } else {
      console.log(`Cleaned up test namespace: ${namespaceId}`);
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
