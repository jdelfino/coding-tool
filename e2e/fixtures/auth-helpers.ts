import { Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { createTestUser, createTestAuthSession, generateTestNamespaceId, createTestNamespace, cleanupNamespace } from '../helpers/db-helpers';

// Re-export namespace helpers for convenience
export { generateTestNamespaceId, createTestNamespace, cleanupNamespace };

/**
 * Test user credentials
 */
export interface TestUser {
  id: string;
  username: string;
  role: 'system-admin' | 'namespace-admin' | 'instructor' | 'student';
  sessionId?: string;
  namespaceId?: string | null;
}

/**
 * Creates a test user and auth session, then signs in via the UI
 * @param namespaceId - Optional namespace ID. If not provided, users are created in 'default' namespace
 */
export async function signInAs(
  page: Page,
  username: string,
  role: 'system-admin' | 'namespace-admin' | 'instructor' | 'student',
  namespaceId?: string
): Promise<TestUser> {
  // Create user and session in database
  const userId = uuidv4();
  await createTestUser(userId, username, role, namespaceId);

  // Navigate to sign-in page
  await page.goto('/auth/signin');

  // Fill in username
  await page.fill('input[name="username"]', username);

  // Submit form
  await page.click('button[type="submit"]');

  // Wait for navigation to complete (redirect after successful sign-in)
  await page.waitForURL(/^(?!.*\/auth\/signin).*$/, { timeout: 10000 });

  return {
    id: userId,
    username,
    role,
    namespaceId: role === 'system-admin' ? null : namespaceId
  };
}

/**
 * Signs in as an instructor
 * @param namespaceId - Optional namespace ID. If not provided, user is created in 'default' namespace
 */
export async function loginAsInstructor(
  page: Page,
  username: string = 'test-instructor',
  namespaceId?: string
): Promise<TestUser> {
  return signInAs(page, username, 'instructor', namespaceId);
}

/**
 * Signs in as a student
 * @param namespaceId - Optional namespace ID. If not provided, user is created in 'default' namespace
 */
export async function loginAsStudent(
  page: Page,
  username: string = 'test-student',
  namespaceId?: string
): Promise<TestUser> {
  return signInAs(page, username, 'student', namespaceId);
}

/**
 * Signs in as a system admin
 */
export async function loginAsSystemAdmin(
  page: Page,
  username: string = 'test-system-admin'
): Promise<TestUser> {
  return signInAs(page, username, 'system-admin');
}

/**
 * Creates a test user with direct session (for API testing)
 * This bypasses the UI and directly creates user + session
 * @param namespaceId - Optional namespace ID. If not provided, user is created in 'default' namespace
 */
export async function createTestUserWithSession(
  username: string,
  role: 'system-admin' | 'namespace-admin' | 'instructor' | 'student',
  namespaceId?: string
): Promise<TestUser> {
  const userId = uuidv4();
  const sessionId = uuidv4();

  await createTestUser(userId, username, role, namespaceId);
  await createTestAuthSession(sessionId, userId);

  return {
    id: userId,
    username,
    role,
    sessionId,
    namespaceId: role === 'system-admin' ? null : namespaceId
  };
}

/**
 * Signs out the current user
 */
export async function signOut(page: Page): Promise<void> {
  // Navigate to home and click sign out if button exists
  await page.goto('/');

  const signOutButton = page.locator('button:has-text("Sign Out"), a:has-text("Sign Out")');
  if (await signOutButton.isVisible()) {
    await signOutButton.click();
  }

  // Wait for redirect to sign-in page
  await page.waitForURL('/auth/signin', { timeout: 5000 });
}
