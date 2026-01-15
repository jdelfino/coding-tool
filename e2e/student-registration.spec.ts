/**
 * E2E Tests for Student Registration via Join Code
 *
 * Tests the student registration flow where new users:
 * 1. Enter a section join code
 * 2. See section preview information
 * 3. Fill out registration form (email, password, username)
 * 4. Get redirected to student dashboard
 *
 * NOTE: These tests require Supabase to be running with proper credentials.
 * They will be skipped if SUPABASE_SECRET_KEY is not set.
 */

import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials, generateTestNamespaceId, cleanupNamespace } from './helpers/db-helpers';
import {
  getSupabaseAdmin,
  setupTestNamespaceWithSection,
  createInstructorForSection,
} from './helpers/test-data';

// Skip E2E tests if Supabase is not configured
const describeE2E = hasSupabaseCredentials() ? test.describe : test.describe.skip;

describeE2E('Student Registration via Join Code', () => {
  test('Student can register with join code from registration page', async ({ page }) => {
    const namespaceId = generateTestNamespaceId();
    const supabase = getSupabaseAdmin();

    try {
      // Setup: Create namespace with class and section
      console.log('Setting up test namespace with section...');
      const { namespace, class: testClass, section } = await setupTestNamespaceWithSection(
        supabase,
        namespaceId
      );
      console.log(`Created section with join code: ${section.joinCode}`);

      // Create an instructor for the section (so it shows in preview)
      const instructor = await createInstructorForSection(
        supabase,
        section.id,
        namespaceId,
        `instructor-${Date.now()}`
      );
      console.log(`Created instructor: ${instructor.username}`);

      // Navigate to student registration page
      await page.goto('/register/student');

      // Wait for page to load
      await expect(page.locator('h2:has-text("Join Your Section")')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Enter your section join code')).toBeVisible();

      // Enter the join code
      console.log(`Entering join code: ${section.joinCode}`);
      await page.fill('input#joinCode', section.joinCode);

      // Click Continue to validate code
      await page.click('button:has-text("Continue")');

      // Wait for section preview to appear
      await expect(page.locator('text=Create Your Account')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=You\'re joining:')).toBeVisible();

      // Verify section info is shown
      await expect(page.locator(`text=${testClass.name}`)).toBeVisible();
      await expect(page.locator(`text=${section.name}`)).toBeVisible();
      console.log('Section preview displayed correctly');

      // Fill out registration form
      const studentEmail = `student_${Date.now()}@test.local`;
      const studentUsername = `student_${Date.now()}`;
      const studentPassword = 'TestPassword123';

      await page.fill('input#email', studentEmail);
      await page.fill('input#username', studentUsername);
      await page.fill('input#password', studentPassword);
      await page.fill('input#confirmPassword', studentPassword);

      // Submit registration
      await page.click('button:has-text("Create Account")');

      // Wait for submission to complete: the button should stop being in "Creating..." state
      await expect(page.locator('button:has-text("Creating account...")')).toBeHidden({ timeout: 10000 });

      // Then check for success (either message or redirect)
      const successVisible = await page.locator('text=Account Created!').isVisible().catch(() => false);
      if (!successVisible) {
        // If success message wasn't visible (fast redirect), wait for navigation
        await page.waitForURL(/\/(student|auth)/, { timeout: 5000 });
      }

      console.log('Student registration completed successfully!');

      // Verify the student was created in the database
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('username', studentUsername)
        .single();

      expect(profile).not.toBeNull();
      expect(profile.role).toBe('student');
      expect(profile.namespace_id).toBe(namespaceId);
      console.log(`Verified student profile created: ${profile.username} with role ${profile.role}`);

      // Verify the student is enrolled in the section
      const { data: membership } = await supabase
        .from('section_memberships')
        .select('*')
        .eq('user_id', profile.id)
        .eq('section_id', section.id)
        .single();

      expect(membership).not.toBeNull();
      console.log('Verified student is enrolled in section');
    } finally {
      await cleanupNamespace(namespaceId);
    }
  });

  test('Join code from URL parameter is pre-filled', async ({ page }) => {
    const namespaceId = generateTestNamespaceId();
    const supabase = getSupabaseAdmin();

    try {
      // Setup: Create namespace with class and section
      console.log('Setting up test namespace with section...');
      const { section, class: testClass } = await setupTestNamespaceWithSection(
        supabase,
        namespaceId
      );
      console.log(`Created section with join code: ${section.joinCode}`);

      // Navigate to student registration page WITH code parameter
      // Remove dashes from join code for URL (it will be reformatted)
      const codeWithoutDashes = section.joinCode.replace(/-/g, '');
      await page.goto(`/register/student?code=${codeWithoutDashes}`);

      // Wait for page to load
      await expect(page.locator('h2:has-text("Join Your Section")')).toBeVisible({ timeout: 10000 });

      // Verify the join code is pre-filled (with dashes added)
      const codeInput = page.locator('input#joinCode');
      await expect(codeInput).toHaveValue(section.joinCode);
      console.log(`Join code pre-filled: ${section.joinCode}`);

      // Click Continue to validate pre-filled code
      await page.click('button:has-text("Continue")');

      // Wait for section preview to appear
      await expect(page.locator('text=Create Your Account')).toBeVisible({ timeout: 10000 });
      await expect(page.locator(`text=${testClass.name}`)).toBeVisible();
      console.log('Section validated from URL parameter');

      // Complete registration
      const studentEmail = `student_url_${Date.now()}@test.local`;
      const studentUsername = `student_url_${Date.now()}`;
      const studentPassword = 'TestPassword123';

      await page.fill('input#email', studentEmail);
      await page.fill('input#username', studentUsername);
      await page.fill('input#password', studentPassword);
      await page.fill('input#confirmPassword', studentPassword);

      await page.click('button:has-text("Create Account")');

      // Wait for submission to complete: either success message appears or we're redirected
      // First wait for the button to stop being in "Creating..." state
      await expect(page.locator('button:has-text("Creating account...")')).toBeHidden({ timeout: 10000 });

      // Then check for success (either message or redirect)
      const successVisible = await page.locator('text=Account Created!').isVisible().catch(() => false);
      if (!successVisible) {
        // If success message wasn't visible, wait for navigation
        await page.waitForURL(/\/(student|auth)/, { timeout: 5000 });
      }

      console.log('Student registration from URL parameter completed successfully!');

      // Verify the student was created
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('username', studentUsername)
        .single();

      expect(profile).not.toBeNull();
      expect(profile.role).toBe('student');
      console.log(`Verified student profile: ${profile.username}`);
    } finally {
      await cleanupNamespace(namespaceId);
    }
  });

  test('Shows error for invalid join code', async ({ page }) => {
    // Navigate to student registration page
    await page.goto('/register/student');

    // Wait for page to load
    await expect(page.locator('h2:has-text("Join Your Section")')).toBeVisible({ timeout: 10000 });

    // Enter an invalid join code
    await page.fill('input#joinCode', 'XXX-999-ZZZ');

    // Click Continue
    await page.click('button:has-text("Continue")');

    // Should show error message
    await expect(page.locator('text=doesn\'t exist')).toBeVisible({ timeout: 10000 });
    console.log('Invalid code error displayed correctly');

    // Should still be on code entry step (not advanced to registration form)
    await expect(page.locator('h2:has-text("Join Your Section")')).toBeVisible();
    await expect(page.locator('text=Create Your Account')).not.toBeVisible();
  });

  test('Shows error when email already exists', async ({ page }) => {
    const namespaceId = generateTestNamespaceId();
    const supabase = getSupabaseAdmin();

    try {
      // Setup
      const { section } = await setupTestNamespaceWithSection(supabase, namespaceId);

      // Create an existing user with a known email
      const existingEmail = `existing-${Date.now()}@test.local`;
      const existingUserId = require('uuid').v4();

      await supabase.auth.admin.createUser({
        id: existingUserId,
        email: existingEmail,
        password: 'TestPassword123',
        email_confirm: true,
      });

      await supabase.from('user_profiles').insert({
        id: existingUserId,
        username: `existing-${Date.now()}`,
        role: 'student',
        namespace_id: namespaceId,
      });

      // Navigate to registration and enter valid code
      await page.goto('/register/student');
      await page.fill('input#joinCode', section.joinCode);
      await page.click('button:has-text("Continue")');

      // Wait for registration form
      await expect(page.locator('text=Create Your Account')).toBeVisible({ timeout: 10000 });

      // Try to register with existing email
      await page.fill('input#email', existingEmail);
      await page.fill('input#username', `new_${Date.now()}`);
      await page.fill('input#password', 'TestPassword123');
      await page.fill('input#confirmPassword', 'TestPassword123');

      await page.click('button:has-text("Create Account")');

      // Should show email exists error
      await expect(page.locator('text=already exists')).toBeVisible({ timeout: 10000 });
      console.log('Duplicate email error displayed correctly');

      // Should offer sign-in link (in the error message)
      await expect(page.locator('a:has-text("Sign in instead")')).toBeVisible();
    } finally {
      await cleanupNamespace(namespaceId);
    }
  });
});
