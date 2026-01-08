/**
 * E2E tests for the Public View feature
 *
 * Tests the public display view that instructors show during class.
 * Based on the critical-paths test flow.
 *
 * NOTE: These tests require Supabase to be running with proper credentials.
 * They will be skipped if SUPABASE_SERVICE_ROLE_KEY is not set.
 */

import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials } from './helpers/db-helpers';
import {
  loginAsInstructor,
  generateTestNamespaceId,
  createTestNamespace,
  cleanupNamespace
} from './fixtures/auth-helpers';

// Skip E2E tests if Supabase is not configured
const describeE2E = hasSupabaseCredentials() ? test.describe : test.describe.skip;

describeE2E('Public View Feature', () => {
  test('Instructor can open public view from session', async ({ browser }) => {
    const namespaceId = generateTestNamespaceId();
    await createTestNamespace(namespaceId);

    try {
      // ===== INSTRUCTOR SETUP =====
      const instructorContext = await browser.newContext();
      const instructorPage = await instructorContext.newPage();
      await loginAsInstructor(instructorPage, `instructor-${namespaceId}`, namespaceId);
      await instructorPage.goto('/instructor');

      await expect(instructorPage.locator('h1:has-text("Instructor Dashboard")')).toBeVisible({ timeout: 10000 });

      // Create class
      const createClassButton = instructorPage.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
      await createClassButton.click();
      await instructorPage.fill('input#class-name', 'Test Class');
      await instructorPage.click('button:has-text("Create Class")');
      await expect(instructorPage.locator('h3:has-text("Test Class")')).toBeVisible({ timeout: 5000 });

      // Click on class
      await instructorPage.locator('button:has-text("Test Class")').first().click();
      await expect(instructorPage.locator('h2:has-text("Test Class")')).toBeVisible({ timeout: 5000 });

      // Create section
      const createSectionButton = instructorPage.locator('button:has-text("New Section"), button:has-text("Create Section")').first();
      await createSectionButton.click();
      await instructorPage.fill('input#section-name', 'Test Section');
      await instructorPage.locator('button[type="submit"]:has-text("Create Section")').click();
      await expect(instructorPage.locator('h3:has-text("Test Section")')).toBeVisible({ timeout: 5000 });

      // Get join code from section card
      const sectionCard = instructorPage.locator('button:has-text("Test Section")').first();
      const cardText = await sectionCard.textContent() || '';
      const joinCodeMatch = cardText.match(/[A-Z0-9]{3}-[A-Z0-9]{3}-[A-Z0-9]{3}|[A-Z0-9]{6}/);
      if (!joinCodeMatch) {
        throw new Error(`Could not find join code: "${cardText}"`);
      }
      const joinCode = joinCodeMatch[0];
      console.log('Section join code:', joinCode);

      // Click on section
      await instructorPage.locator('button:has-text("Test Section")').first().click();

      // Create session
      const newSessionButton = instructorPage.locator('button:has-text("New Session"), button:has-text("Create First Session")').first();
      await newSessionButton.click();
      await expect(instructorPage.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });

      // ===== OPEN PUBLIC VIEW =====
      // Click the "Open Public View" button which opens in a new tab
      const [publicViewPage] = await Promise.all([
        instructorPage.context().waitForEvent('page'),
        instructorPage.locator('button:has-text("Open Public View")').click()
      ]);

      // Verify public view loaded
      await expect(publicViewPage.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 10000 });

      // Verify join code is displayed
      await expect(publicViewPage.locator(`text=${joinCode}`)).toBeVisible({ timeout: 5000 });

      // Verify "No submission selected" message (since no student featured yet)
      await expect(publicViewPage.locator('text=No submission selected for display')).toBeVisible({ timeout: 5000 });

      console.log('Public view test completed successfully!');

      await publicViewPage.close();
      await instructorContext.close();
    } finally {
      await cleanupNamespace(namespaceId);
    }
  });
});
