import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials } from './helpers/db-helpers';
import {
  loginAsInstructor,
  loginAsStudent,
  generateTestNamespaceId,
  createTestNamespace,
  cleanupNamespace,
  navigateToSessions,
  navigateToClasses,
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

      // Wait for the instructor page to load - look for class-related content
      await expect(instructorPage.locator('h2:has-text("Your Classes"), h3:has-text("No Classes Yet"), button:has-text("Create Your First Class")').first()).toBeVisible({ timeout: 10000 });

      // Create class
      const createClassButton = instructorPage.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
      await createClassButton.click();
      await expect(instructorPage.locator('h2:has-text("Create New Class")')).toBeVisible({ timeout: 5000 });
      await instructorPage.fill('input#class-name', 'Test Class');
      await instructorPage.click('button:has-text("Create Class")');

      // Wait for class to appear in list
      await expect(instructorPage.locator('h3:has-text("Test Class")')).toBeVisible({ timeout: 5000 });

      // Click on the class to view sections
      await instructorPage.locator('button:has-text("Test Class")').first().click();

      // Wait for sections view
      await expect(instructorPage.locator('h2:has-text("Test Class")')).toBeVisible({ timeout: 5000 });

      // Create section
      const createSectionButton = instructorPage.locator('button:has-text("New Section"), button:has-text("Create Section")').first();
      await createSectionButton.click();
      await expect(instructorPage.locator('h2:has-text("Create New Section")')).toBeVisible({ timeout: 5000 });
      await instructorPage.fill('input#section-name', 'Test Section');
      await instructorPage.locator('button[type="submit"]:has-text("Create Section")').click();

      // Wait for section to appear
      await expect(instructorPage.locator('h3:has-text("Test Section")')).toBeVisible({ timeout: 5000 });

      // Get join code from section card - it appears after the key icon
      // The join code could be 6 chars (ABC123) or formatted with dashes (XXX-XXX-XXX)
      const sectionCard = instructorPage.locator('button:has-text("Test Section")').first();
      const cardText = await sectionCard.textContent() || '';
      // Extract what looks like a join code: XXX-XXX (new format), XXX-XXX-XXX (old), or XXXXXX
      const joinCodeMatch = cardText.match(/[A-Z0-9]{3}-[A-Z0-9]{3}(?:-[A-Z0-9]{3})?|[A-Z0-9]{6}/);
      if (!joinCodeMatch) {
        throw new Error(`Could not find join code in section card: "${cardText}"`);
      }
      const joinCode = joinCodeMatch[0];
      console.log('Section join code:', joinCode);

      // Click on section to view it
      await instructorPage.locator('button:has-text("Test Section")').first().click();
      await expect(instructorPage.locator('h2:has-text("Test Section")')).toBeVisible({ timeout: 5000 });

      // Create session from section view
      const newSessionButton = instructorPage.locator('button:has-text("New Session"), button:has-text("Create First Session")').first();
      await newSessionButton.click();

      // Wait for session to be created and session view to appear
      await expect(instructorPage.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });

      // Navigate back to Dashboard via sidebar to verify sidebar navigation works
      await navigateToDashboard(instructorPage);
      await expect(instructorPage.locator('h2:has-text("Your Classes"), h3:has-text("No Classes Yet")').first()).toBeVisible({ timeout: 5000 });

      // Navigate to Sessions via sidebar to verify the active session appears
      await navigateToSessions(instructorPage);
      await expect(instructorPage.locator('h2:has-text("Sessions")')).toBeVisible({ timeout: 5000 });
      // The active session should be visible in the list
      await expect(instructorPage.locator('text=Test Section')).toBeVisible({ timeout: 5000 });

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
      // - Instructor created class + section + session
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
