import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials } from './helpers/db-helpers';
import {
  loginAsInstructor,
  loginAsStudent,
  generateTestNamespaceId,
  createTestNamespace,
  cleanupNamespace,
  navigateToDashboard,
} from './fixtures/auth-helpers';

/**
 * Critical Path E2E Tests
 *
 * This test covers the complete end-to-end user journey:
 * 1. Instructor creates class and section
 * 2. Instructor starts a coding session
 * 3. Student joins section via join code
 * 4. Student participates in session and runs code
 *
 * This is the most important test to maintain - it verifies the core
 * functionality that users depend on from start to finish.
 *
 * NOTE: These tests require Supabase to be running with proper credentials.
 * They will be skipped if SUPABASE_SECRET_KEY is not set.
 */

// Skip E2E tests if Supabase is not configured
const describeE2E = hasSupabaseCredentials() ? test.describe : test.describe.skip;

describeE2E('Critical User Paths', () => {
  test('Complete workflow: Instructor setup and student participation', async ({ page, browser }) => {
    // Create unique namespace for this test
    const namespaceId = generateTestNamespaceId();
    await createTestNamespace(namespaceId);

    try {
      // ===== INSTRUCTOR SETUP =====
      const instructorContext = await browser.newContext();
      const instructorPage = await instructorContext.newPage();
      await loginAsInstructor(instructorPage, `instructor-${namespaceId}`, namespaceId);
      await instructorPage.goto('/instructor');

      // Wait for the instructor dashboard to load
      // New dashboard shows "Dashboard" heading or empty state with "Create Your First Class"
      await expect(instructorPage.locator('h2:has-text("Dashboard"), button:has-text("Create Your First Class")').first()).toBeVisible({ timeout: 10000 });

      // Create class from dashboard
      const createClassButton = instructorPage.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
      await createClassButton.click();
      await expect(instructorPage.locator('h2:has-text("Create New Class")')).toBeVisible({ timeout: 5000 });
      await instructorPage.fill('input#class-name', 'Test Class');
      await instructorPage.click('button:has-text("Create Class")');

      // Wait for class to appear in dashboard table (as a table cell, not h3)
      await expect(instructorPage.locator('td:has-text("Test Class"), div:has-text("Test Class")').first()).toBeVisible({ timeout: 5000 });

      // Click "Edit" link to go to class details page where we can create sections
      await instructorPage.locator('a:has-text("Edit")').first().click();

      // Wait for class details page to load
      await expect(instructorPage.locator('h1:has-text("Test Class")')).toBeVisible({ timeout: 5000 });

      // Create section from class details page
      const createSectionButton = instructorPage.locator('button:has-text("New Section"), button:has-text("Create First Section")').first();
      await createSectionButton.click();

      // Fill in section form (input has id="sectionName")
      await expect(instructorPage.locator('input#sectionName').first()).toBeVisible({ timeout: 5000 });
      await instructorPage.fill('input#sectionName', 'Test Section');
      await instructorPage.locator('button[type="submit"]:has-text("Create"), button:has-text("Create Section")').first().click();

      // Wait for section to appear - look for section card or table row
      await expect(instructorPage.locator('text=Test Section').first()).toBeVisible({ timeout: 5000 });

      // Navigate back to dashboard
      await navigateToDashboard(instructorPage);
      await expect(instructorPage.locator('h2:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });

      // Now the section should appear in the dashboard table with "Start Session" button
      await expect(instructorPage.locator('text=Test Section')).toBeVisible({ timeout: 5000 });

      // Get join code from dashboard table using data-testid
      const joinCodeElement = instructorPage.locator('[data-testid="join-code"]').first();
      await expect(joinCodeElement).toBeVisible({ timeout: 5000 });
      const joinCode = await joinCodeElement.textContent();
      if (!joinCode) {
        throw new Error('Could not find join code on dashboard page');
      }
      console.log('Section join code:', joinCode);

      // Click "Start Session" to open the modal
      await instructorPage.locator('button:has-text("Start Session")').first().click();

      // Wait for the Start Session modal
      await expect(instructorPage.locator('h2:has-text("Start Session")')).toBeVisible({ timeout: 5000 });

      // Click "Create blank session" option to enable the Start Session button
      await instructorPage.locator('button:has-text("Create blank session")').click();

      // Wait for Start Session button to be enabled, then click it
      await expect(instructorPage.locator('button:has-text("Start Session"):not([disabled])').last()).toBeEnabled({ timeout: 5000 });
      await instructorPage.locator('button:has-text("Start Session"):not([disabled])').last().click();

      // Wait for navigation to session page
      await expect(instructorPage).toHaveURL(/\/instructor\/session\//, { timeout: 10000 });

      // Verify session view loaded (check for h2 heading "Active Session")
      await expect(instructorPage.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });

      // ===== STUDENT FLOW =====
      // Student joins the section using the join code
      await loginAsStudent(page, `student-${namespaceId}`, namespaceId);
      await page.goto('/sections');
      await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

      // Join section with join code
      const joinSectionButton = page.locator('button:has-text("Join Section"), button:has-text("Join Your First Section")').first();
      await joinSectionButton.click();
      // Wait for navigation to join page
      await expect(page).toHaveURL('/sections/join', { timeout: 5000 });
      await expect(page.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });
      console.log('Entering join code:', joinCode);
      await page.fill('input#joinCode', joinCode);
      await page.click('button[type="submit"]:has-text("Join Section")');

      // Wait for redirect back to sections page after successful join
      await expect(page).toHaveURL('/sections', { timeout: 5000 });
      await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

      // Wait for the section card with active session to load
      // The "Join Now" button appears when session data is loaded
      const joinNowButton = page.locator('button:has-text("Join Now")');
      await expect(joinNowButton).toBeVisible({ timeout: 10000 });

      // Click "Join Now" to join the active session
      await joinNowButton.click();

      // Verify student entered session
      await expect(page.locator('h1:has-text("Live Coding Session")')).toBeVisible({ timeout: 10000 });

      // Verify connected status
      await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 });

      // Verify the Run Code button is present (confirms editor loaded)
      await expect(page.locator('button:has-text("Run Code")')).toBeVisible({ timeout: 10000 });

      // Success! The complete flow works:
      // - Instructor created class + section from dashboard
      // - Instructor started session from dashboard modal
      // - Student joined section and entered the active session
      console.log('Critical path test completed successfully!');

      // Cleanup
      await instructorContext.close();
    } finally {
      // Clean up namespace after test
      await cleanupNamespace(namespaceId);
    }
  });
});
