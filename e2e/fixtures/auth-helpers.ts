import { Page } from '@playwright/test';
import { v4 as uuidv4 } from 'uuid';
import {
  createTestUser,
  generateTestNamespaceId,
  createTestNamespace,
  cleanupNamespace,
  getTestUserEmail,
  getTestUserPassword
} from '../helpers/db-helpers';
import { waitForEmail, extractOtpCode } from '../helpers/inbucket-client';

// Re-export namespace helpers for convenience
export { generateTestNamespaceId, createTestNamespace, cleanupNamespace };

/**
 * Test user credentials
 */
export interface TestUser {
  id: string;
  username: string;
  email: string;  // NEW: Email field for Supabase Auth
  role: 'system-admin' | 'namespace-admin' | 'instructor' | 'student';
  sessionId?: string;
  namespaceId?: string | null;
}

/**
 * Creates a test user via Supabase, then signs in via the UI using email/password
 * For system-admin users, handles MFA verification flow
 * @param namespaceId - Optional namespace ID. If not provided, users are created in 'default' namespace
 */
export async function signInAs(
  page: Page,
  username: string,
  role: 'system-admin' | 'namespace-admin' | 'instructor' | 'student',
  namespaceId?: string
): Promise<TestUser> {
  // Create user in Supabase (auth.users + user_profiles)
  const userId = uuidv4();
  const email = getTestUserEmail(username);
  const password = getTestUserPassword();

  await createTestUser(userId, username, role, namespaceId);

  // Record time before sign-in to filter emails
  const beforeSignIn = new Date();

  // Navigate to sign-in page
  await page.goto('/auth/signin');

  // Fill in email and password (not username)
  await page.fill('input[name="email"]', email);
  await page.fill('input[name="password"]', password);

  // Submit form
  await page.click('button[type="submit"]');

  // For system-admin users, handle MFA flow
  if (role === 'system-admin') {
    // Wait for MFA verification form to appear
    await page.waitForSelector('input#mfaCode', { timeout: 10000 });

    // Wait for OTP email to arrive
    const otpEmail = await waitForEmail(email, {
      timeout: 30000,
      afterDate: beforeSignIn,
      subjectContains: 'verification',
    });

    if (!otpEmail) {
      throw new Error(`MFA email not received for ${email}`);
    }

    const otpCode = extractOtpCode(otpEmail);
    if (!otpCode) {
      throw new Error(`Could not extract OTP code from email for ${email}`);
    }

    // Enter the OTP code
    await page.fill('input#mfaCode', otpCode);

    // Submit MFA form
    await page.click('button[type="submit"]');
  }

  // Wait for navigation to complete (redirect after successful sign-in)
  await page.waitForURL(/^(?!.*\/auth\/signin).*$/, { timeout: 10000 });

  return {
    id: userId,
    username,
    email,
    role,
    namespaceId: role === 'system-admin' ? null : namespaceId || 'default'
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
 * Creates a test user with Supabase auth (for API testing)
 * This creates the user but does NOT create a session - tests should call /api/auth/signin
 * @param namespaceId - Optional namespace ID. If not provided, user is created in 'default' namespace
 */
export async function createTestUserWithSession(
  username: string,
  role: 'system-admin' | 'namespace-admin' | 'instructor' | 'student',
  namespaceId?: string
): Promise<TestUser> {
  const userId = uuidv4();
  const email = getTestUserEmail(username);

  await createTestUser(userId, username, role, namespaceId);

  return {
    id: userId,
    username,
    email,
    role,
    namespaceId: role === 'system-admin' ? null : namespaceId || 'default'
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
