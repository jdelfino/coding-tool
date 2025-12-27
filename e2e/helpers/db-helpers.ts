import * as fs from 'fs';
import * as path from 'path';

/**
 * Path to the data directory
 */
const DATA_DIR = path.join(process.cwd(), 'data');

/**
 * Clears all test data by resetting data directory to empty state
 * Creates empty JSON files with empty objects/arrays
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
}

/**
 * Resets data directory to a known good state for testing
 * Includes creating test users if needed
 */
export async function resetTestData(): Promise<void> {
  await clearTestData();
}

/**
 * Reads a data file from the data directory
 */
export async function readDataFile(filename: string): Promise<any> {
  const filePath = path.join(DATA_DIR, filename);
  const content = await fs.promises.readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Writes data to a file in the data directory
 */
export async function writeDataFile(filename: string, data: any): Promise<void> {
  const filePath = path.join(DATA_DIR, filename);
  await fs.promises.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}

/**
 * Creates a test user in the data directory
 */
export async function createTestUser(userId: string, username: string, role: 'instructor' | 'student'): Promise<void> {
  const users = await readDataFile('users.json');
  users[userId] = {
    id: userId,
    username,
    role,
    createdAt: new Date().toISOString(),
    lastLoginAt: new Date().toISOString()
  };
  await writeDataFile('users.json', users);
}

/**
 * Creates a test auth session for a user
 */
export async function createTestAuthSession(sessionId: string, userId: string): Promise<void> {
  const sessions = await readDataFile('auth-sessions.json');
  sessions[sessionId] = {
    id: sessionId,
    userId,
    createdAt: new Date().toISOString(),
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
  };
  await writeDataFile('auth-sessions.json', sessions);
}
