import { Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import { createTestUser, createTestAuthSession } from '../helpers/db-helpers';

/**
 * Test user credentials
 */
export interface TestUser {
  id: string;
  username: string;
  role: 'instructor' | 'student';
  sessionId?: string;
}

/**
 * Creates a test user and auth session, then signs in via the UI
 */
export async function signInAs(
  page: Page, 
  username: string, 
  role: 'instructor' | 'student'
): Promise<TestUser> {
  // Create user and session in database
  const userId = uuidv4();
  await createTestUser(userId, username, role);
  
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
    role
  };
}

/**
 * Signs in as an instructor
 */
export async function loginAsInstructor(
  page: Page, 
  username: string = 'test-instructor'
): Promise<TestUser> {
  return signInAs(page, username, 'instructor');
}

/**
 * Signs in as a student
 */
export async function loginAsStudent(
  page: Page, 
  username: string = 'test-student'
): Promise<TestUser> {
  return signInAs(page, username, 'student');
}

/**
 * Creates a test user with direct session (for API testing)
 * This bypasses the UI and directly creates user + session
 */
export async function createTestUserWithSession(
  username: string,
  role: 'instructor' | 'student'
): Promise<TestUser> {
  const userId = uuidv4();
  const sessionId = uuidv4();
  
  await createTestUser(userId, username, role);
  await createTestAuthSession(sessionId, userId);
  
  return {
    id: userId,
    username,
    role,
    sessionId
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
