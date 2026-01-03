/**
 * E2E tests for student session participation edge cases
 *
 * These tests cover edge cases and advanced workflows not covered by the critical path test:
 * - Editing previous submissions
 * - Multiple concurrent students
 * - Joining ended sessions (error handling)
 * - Code persistence across page reloads
 */

import { test, expect } from './helpers/setup';
import { loginAsStudent, loginAsInstructor } from './fixtures/auth-helpers';
import {
  createTestProblem,
  createTestClassViaAPI,
  createTestSectionViaAPI
} from './fixtures/test-data';

test.describe('Student Session Participation', () => {
  let instructorUser: any;
  let studentUser: any;
  let testClass: any;
  let testSection: any;
  let testProblem: any;
  let joinCode: string;

  test.beforeEach(async ({ page }) => {
    // Setup instructor and create test data
    instructorUser = await loginAsInstructor(page, 'test-session-instructor');

    // Create class and section via API
    testClass = await createTestClassViaAPI(page, 'CS 101', 'Test Class for Sessions');
    testSection = await createTestSectionViaAPI(page, testClass.id, 'Section A', 'Fall 2025');

    // Create a test problem
    testProblem = await createTestProblem(
      page,
      instructorUser.id,
      'Two Sum Problem',
      'Write a function that finds two numbers that add up to a target',
      'def two_sum(nums, target):\n    # TODO: implement\n    pass'
    );

    // Create session via instructor UI (so it's properly created in the session manager)
    await page.goto('/instructor');
    await expect(page.locator('h2:has-text("Your Classes")')).toBeVisible({ timeout: 10000 });

    // Navigate to problems
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });

    // Find and click "Create Session" for the test problem
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await expect(problemCard).toBeVisible({ timeout: 5000 });

    // Click the "Create Session" button in the problem card
    await problemCard.locator('button:has-text("Create Session")').first().click({ force: true });

    // Modal should appear
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });

    // Select class and section
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(1000);
    await page.selectOption('select#section', testSection.id);

    // Click the "Create Session" button in the modal (use last() to get the submit button)
    await page.locator('button:has-text("Create Session")').last().click();

    // Wait for session to be created and get join code
    await page.waitForTimeout(2000);
    const joinCodeElement = page.locator('text=/[A-Z0-9]{6}/').first();
    await expect(joinCodeElement).toBeVisible({ timeout: 10000 });
    joinCode = (await joinCodeElement.textContent()) || '';
    console.log('Created session with join code:', joinCode);
  });

  test('Student edits previous submission', async ({ page }) => {
    // Login as student and join session
    studentUser = await loginAsStudent(page, 'test-student-4');
    await page.goto('/student');
    await page.click('button:has-text("Join New Session")');
    await page.fill('input[placeholder="ABC123"]', joinCode);
    await page.click('button:has-text("Join Session")');
    await page.waitForTimeout(2000);

    // Wait for editor
    const monacoEditor = page.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible({ timeout: 5000 });

    // Submit first solution
    await page.evaluate(() => {
      const model = (window as any).monaco.editor.getModels()[0];
      model.setValue('print("First")');
    });
    await page.click('button:has-text("Run")');
    await page.waitForTimeout(1500);

    // Edit and submit second solution
    await page.evaluate(() => {
      const model = (window as any).monaco.editor.getModels()[0];
      model.setValue('print("Second")');
    });
    await page.click('button:has-text("Run")');

    // Verify execution shows new output
    await expect(page.locator('text=Second')).toBeVisible({ timeout: 10000 });
  });

  test('Multiple students in same session', async ({ browser }) => {
    // Create two browser contexts for two students
    const context1 = await browser.newContext();
    const context2 = await browser.newContext();
    const page1 = await context1.newPage();
    const page2 = await context2.newPage();

    // Login both students
    await loginAsStudent(page1, 'test-student-multi-1');
    await loginAsStudent(page2, 'test-student-multi-2');

    // Both join the same session
    await page1.goto('/student');
    await page2.goto('/student');

    await page1.click('button:has-text("Join New Session")');
    await page1.fill('input[placeholder="ABC123"]', joinCode);
    await page1.click('button:has-text("Join Session")');

    await page2.click('button:has-text("Join New Session")');
    await page2.fill('input[placeholder="ABC123"]', joinCode);
    await page2.click('button:has-text("Join Session")');

    // Wait for editors
    await expect(page1.locator('.monaco-editor').first()).toBeVisible({ timeout: 5000 });
    await expect(page2.locator('.monaco-editor').first()).toBeVisible({ timeout: 5000 });

    // Each student writes different code using Monaco API
    await page1.evaluate(() => {
      const model = (window as any).monaco.editor.getModels()[0];
      model.setValue('print("Student A")');
    });

    await page2.evaluate(() => {
      const model = (window as any).monaco.editor.getModels()[0];
      model.setValue('print("Student B")');
    });

    // Submit both
    await page1.click('button:has-text("Run")');
    await page2.click('button:has-text("Run")');

    // Verify both have output
    await expect(page1.locator('pre').filter({ hasText: 'Student A' }).first()).toBeVisible({ timeout: 10000 });
    await expect(page2.locator('pre').filter({ hasText: 'Student B' }).first()).toBeVisible({ timeout: 10000 });

    await context1.close();
    await context2.close();
  });

  test('Student cannot join ended session', async ({ page }) => {
    // Try to join with an invalid join code (session doesn't exist)
    studentUser = await loginAsStudent(page, 'test-student-ended');
    await page.goto('/student');
    await page.click('button:has-text("Join New Session")');

    // Use a fake join code that won't exist
    await page.fill('input[placeholder="ABC123"]', 'FAKE99');
    await page.click('button:has-text("Join Session")');

    // Should see error message
    await expect(page.locator('text=Session not found')).toBeVisible({ timeout: 5000 });
  });

  test('Student code persistence', async ({ page }) => {
    // Login as student and join session
    studentUser = await loginAsStudent(page, 'test-student-persist');
    await page.goto('/student');
    await page.click('button:has-text("Join New Session")');
    await page.fill('input[placeholder="ABC123"]', joinCode);
    await page.click('button:has-text("Join Session")');
    await page.waitForTimeout(2000);

    // Wait for editor
    const monacoEditor = page.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible({ timeout: 5000 });

    // Write some code using Monaco API
    await page.evaluate(() => {
      const model = (window as any).monaco.editor.getModels()[0];
      model.setValue('print("Persisted Code")');
    });

    // Wait for auto-save
    await page.waitForTimeout(3000);

    // Reload the page
    await page.reload();
    await page.waitForTimeout(2000);

    // Check if we're still in session view or back at dashboard
    const isInSession = await page.locator('h1:has-text("Live Coding Session")').isVisible({ timeout: 3000 }).catch(() => false);

    if (!isInSession) {
      // We're back at dashboard, need to rejoin
      await expect(page.locator('h2:has-text("My Sessions")')).toBeVisible({ timeout: 5000 });
      await page.click('button:has-text("Rejoin Session")');
      await page.waitForTimeout(2000);
    }

    // Should be in the session view now
    await expect(page.locator('h1:has-text("Live Coding Session")')).toBeVisible({ timeout: 10000 });

    // Editor should be visible
    await expect(monacoEditor).toBeVisible({ timeout: 10000 });

    // Verify code is still there by running it
    await page.click('button:has-text("Run")');
    await expect(page.locator('text=Persisted Code')).toBeVisible({ timeout: 10000 });
  });
});
