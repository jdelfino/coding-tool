import { test, expect } from './helpers/setup';
import {
  loginAsInstructor,
  loginAsStudent,
  generateTestNamespaceId,
  createTestNamespace,
  cleanupNamespace
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
 */

test.describe('Critical User Paths', () => {
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
      await expect(instructorPage.locator('h1:has-text("Instructor Dashboard")')).toBeVisible({ timeout: 10000 });

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

      // Get join code from section card (6-character alphanumeric code)
      const joinCodeElement = instructorPage.locator('text=/[A-Z0-9]{6}/').first();
      await expect(joinCodeElement).toBeVisible({ timeout: 5000 });
      const joinCode = (await joinCodeElement.textContent()) || '';
      console.log('Section join code:', joinCode);

      // Click on section to view it
      await instructorPage.locator('button:has-text("Test Section")').first().click();
      await expect(instructorPage.locator('h2:has-text("Test Section")')).toBeVisible({ timeout: 5000 });

      // Create session from section view
      const newSessionButton = instructorPage.locator('button:has-text("New Session"), button:has-text("Create First Session")').first();
      await newSessionButton.click();

      // Wait for session to be created and session view to appear
      await expect(instructorPage.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });

      // ===== STUDENT FLOW =====
      // Student joins the section using the join code
      await loginAsStudent(page, `student-${namespaceId}`, namespaceId);
      await page.goto('/sections');
      await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

      // Join section with join code
      const joinSectionButton = page.locator('button:has-text("Join Section"), button:has-text("Join Your First Section")').first();
      await joinSectionButton.click();
      await expect(page.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });
      await page.fill('input#joinCode', joinCode);
      await page.click('button[type="submit"]:has-text("Join Section")');

      // Wait for redirect back to sections page after successful join
      await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

      // The active session should be visible - look for "Join Now" button
      const joinNowButton = page.locator('button:has-text("Join Now")');
      await expect(joinNowButton).toBeVisible({ timeout: 10000 });

      // Click "Join Now" to join the active session
      await joinNowButton.click();

      // Verify student entered session
      await expect(page.locator('h1:has-text("Live Coding Session")')).toBeVisible({ timeout: 10000 });

      // Write code in Monaco editor
      const monacoEditor = page.locator('.monaco-editor').first();
      await expect(monacoEditor).toBeVisible({ timeout: 10000 });

      // Set code value via Monaco API
      await page.evaluate(() => {
        const model = (window as any).monaco?.editor?.getModels()?.[0];
        if (model) {
          model.setValue('print("Hello World")');
        }
      });

      // Wait for code to be set
      await page.waitForTimeout(1000);

      // Run the code
      await page.click('button:has-text("Run")');

      // Verify execution output
      await expect(page.locator('pre:has-text("Hello World")')).toBeVisible({ timeout: 10000 });

      // Cleanup
      await instructorContext.close();
    } finally {
      // Clean up namespace after test
      await cleanupNamespace(namespaceId);
    }
  });
});
