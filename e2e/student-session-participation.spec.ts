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
    await expect(page.locator('h2:has-text("Your Classes")')).toBeVisible({ timeout: 5000 });

    // Navigate to problems
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 5000 });

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

    // Wait for session to be created - check for Active Session header
    await expect(page.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 5000 });

    // Join code comes from the section, not the session
    joinCode = testSection.joinCode;
    console.log('Created session with join code:', joinCode);
  });

  test('Student edits previous submission', async ({ page }) => {
    // Login as student and join session
    studentUser = await loginAsStudent(page, 'test-student-4');

    // Navigate to sections page and join section
    await page.goto('/sections');
    await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

    // Click join section button
    await page.click('button:has-text("Join Section"), button:has-text("Join Your First Section")');
    await expect(page.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });

    // Enter join code and join section
    await page.fill('input#joinCode', joinCode);
    await page.click('button:has-text("Join Section")');

    // Wait for redirect back to sections page
    await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

    // Wait for active session to appear and join it
    const joinNowButton = page.locator('button:has-text("Join Now")');
    await expect(joinNowButton).toBeVisible({ timeout: 5000 });
    await joinNowButton.click();

    // Wait for navigation to student page
    await page.waitForURL(/\/student\?sessionId=/, { timeout: 5000 });

    // Wait for session to load
    await expect(page.locator('button:has-text("Leave Session")')).toBeVisible({ timeout: 5000 });

    // Wait for problem to be loaded before expecting Monaco
    await expect(page.locator('h2, h3').filter({ hasText: testProblem.title })).toBeVisible({ timeout: 5000 });

    // Wait a moment for React to render
    await page.waitForTimeout(500);

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
    await expect(page.locator('text=Second')).toBeVisible({ timeout: 5000 });
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

    // Student 1 joins section and session
    await page1.goto('/sections');
    await expect(page1.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });
    await page1.click('button:has-text("Join Section"), button:has-text("Join Your First Section")');
    await expect(page1.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });
    await page1.fill('input#joinCode', joinCode);
    await page1.click('button:has-text("Join Section")');
    await expect(page1.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });
    await page1.click('button:has-text("Join Now")');
    await page1.waitForURL(/\/student\?sessionId=/, { timeout: 5000 });

    // Wait for student 1 session to fully load
    await expect(page1.locator('button:has-text("Leave Session")')).toBeVisible({ timeout: 5000 });
    await expect(page1.locator('h2, h3').filter({ hasText: testProblem.title })).toBeVisible({ timeout: 5000 });
    await page1.waitForTimeout(500); // Wait for React to render

    // Student 2 joins section and session
    await page2.goto('/sections');
    await expect(page2.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });
    await page2.click('button:has-text("Join Section"), button:has-text("Join Your First Section")');
    await expect(page2.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });
    await page2.fill('input#joinCode', joinCode);
    await page2.click('button:has-text("Join Section")');
    await expect(page2.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });
    await page2.click('button:has-text("Join Now")');
    await page2.waitForURL(/\/student\?sessionId=/, { timeout: 5000 });

    // Wait for student 2 session to fully load
    await expect(page2.locator('button:has-text("Leave Session")')).toBeVisible({ timeout: 5000 });
    await expect(page2.locator('h2, h3').filter({ hasText: testProblem.title })).toBeVisible({ timeout: 5000 });
    await page2.waitForTimeout(500); // Wait for React to render

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
    await expect(page1.locator('pre').filter({ hasText: 'Student A' }).first()).toBeVisible({ timeout: 5000 });
    await expect(page2.locator('pre').filter({ hasText: 'Student B' }).first()).toBeVisible({ timeout: 5000 });

    await context1.close();
    await context2.close();
  });

  test('Student code persistence', async ({ page }) => {
    // Login as student and join session
    studentUser = await loginAsStudent(page, 'test-student-persist');

    // Navigate to sections page and join section
    await page.goto('/sections');
    await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Join Section"), button:has-text("Join Your First Section")');
    await expect(page.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });
    await page.fill('input#joinCode', joinCode);
    await page.click('button:has-text("Join Section")');
    await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Join Now")');
    await page.waitForURL(/\/student\?sessionId=/, { timeout: 5000 });

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

    // Should still be in the session view (URL should persist)
    await expect(page.locator('h1:has-text("Live Coding Session")')).toBeVisible({ timeout: 5000 });

    // Editor should be visible
    await expect(monacoEditor).toBeVisible({ timeout: 5000 });

    // Verify code is still there by running it
    await page.click('button:has-text("Run")');
    await expect(page.locator('text=Persisted Code')).toBeVisible({ timeout: 5000 });
  });
});
