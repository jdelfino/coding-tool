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
    'revisions.json'
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
 */
export async function createTestUser(userId: string, username: string, role: 'instructor' | 'student'): Promise<void> {
  try {
    // Use the signin endpoint which auto-creates users
    const response = await fetch(`${API_BASE_URL}/api/auth/signin`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, role }),
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
