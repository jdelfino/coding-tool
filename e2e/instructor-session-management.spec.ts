import { test, expect } from './helpers/setup';
import { loginAsInstructor } from './fixtures/auth-helpers';
import { createTestProblem, createTestClassViaAPI, createTestSectionViaAPI } from './fixtures/test-data';

/**
 * E2E tests for instructor session management workflows
 * Tests: create session from problem, session validation, end session, view details, multiple sessions
 * 
 * These tests verify the session lifecycle and catch issues with session creation,
 * problem loading, and session state management.
 */

test.describe('Instructor Session Management', () => {
  let instructorUser: any;
  let testClass: any;
  let testSection: any;
  let testProblem: any;

  test.beforeEach(async ({ page }) => {
    // Login as instructor before each test
    instructorUser = await loginAsInstructor(page, 'test-session-instructor');
    
    // Create a class and section via API (so they're available in the modal)
    testClass = await createTestClassViaAPI(page, 'CS 101', 'Test Class for Sessions');
    testSection = await createTestSectionViaAPI(page, testClass.id, 'Section A', 'Fall 2025');
    
    // Create a test problem (now requires page context for auth)
    testProblem = await createTestProblem(
      page,
      instructorUser.id,
      'Two Sum Problem',
      'Write a function that finds two numbers that add up to a target',
      'def two_sum(nums, target):\n    # TODO: implement\n    pass'
    );
    
    // Navigate to instructor dashboard
    await page.goto('/instructor');
    
    // Wait for page to load - check for either heading
    await expect(page.locator('h1:has-text("Instructor Dashboard")')).toBeVisible({ timeout: 10000 });
  });

  test('should create session from existing problem', async ({ page }) => {
    // Navigate to problems section
    await page.click('button:has-text("Problems")');
    
    // Wait for problems library to load
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    // Find and click "Create Session" button for the test problem
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await expect(problemCard).toBeVisible({ timeout: 5000 });
    await problemCard.locator('button:has-text("Create Session")').click();
    
    // Modal should appear
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    // Wait for class select to be available
    await page.waitForSelector('select#class', { timeout: 10000 });
    
    // Select class
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(1000); // Wait for sections to load
    
    // Select section
    await page.selectOption('select#section', testSection.id);
    
    // Verify summary is shown
    await expect(page.locator('text=Session Summary')).toBeVisible();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible();
    
    // Create session - use force click to handle any overlay issues
    await page.locator('button:has-text("Create Session")').last().click({ force: true });
    
    // Should navigate to session view or show success
    await expect(page.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });
    
    // Verify join code is displayed (more reliable than problem title which may be in collapsed sections)
    await expect(page.locator('text=Join Code')).toBeVisible({ timeout: 5000 });
  });

  test('should validate session creation requires section selection', async ({ page }) => {
    // Navigate to problems section
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    // Click "Create Session" button
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await problemCard.locator('button:has-text("Create Session")').click();
    
    // Modal should appear
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    // Try to create session without selecting anything
    const createButton = page.locator('button:has-text("Create Session")').last();
    await expect(createButton).toBeDisabled();
    
    // Select class only
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(500);
    
    // Button should still be disabled (no section selected)
    await expect(createButton).toBeDisabled();
    
    // Select section
    await page.selectOption('select#section', testSection.id);
    
    // Now button should be enabled
    await expect(createButton).toBeEnabled();
    
    // Create session successfully
    await createButton.click({ force: true });
    await expect(page.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });
  });

  test('should end active session', async ({ page }) => {
    // First create a session
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await problemCard.locator('button:has-text("Create Session")').click();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(500);
    await page.selectOption('select#section', testSection.id);
    await page.locator('button:has-text("Create Session")').last().click({ force: true });
    
    // Wait for session to be active
    await expect(page.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });
    
    // Set up dialog handler BEFORE clicking
    page.once('dialog', async dialog => {
      expect(dialog.message()).toContain('end this session');
      await dialog.accept();
    });
    
    // Click "End Session" button
    const endButton = page.locator('button:has-text("End Session")');
    await expect(endButton).toBeVisible();
    await endButton.click();
    
    // Should navigate away from session view
    await expect(page.locator('h2:has-text("Active Session")')).not.toBeVisible({ timeout: 10000 });
    
    // Verify we're back at a different view (classes or sessions list)
    await expect(page.locator('h2').filter({ hasText: /Your Classes|Active Sessions/ })).toBeVisible({ timeout: 5000 });
  });

  test('should view session details', async ({ page }) => {
    // Create a session first
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await problemCard.locator('button:has-text("Create Session")').click();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(500);
    await page.selectOption('select#section', testSection.id);
    await page.locator('button:has-text("Create Session")').last().click({ force: true });
    
    await expect(page.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });
    
    // Verify join code is shown (more reliable than problem title)
    await expect(page.locator('text=Join Code')).toBeVisible();
    
    // Verify join code is shown
    await expect(page.locator('text=Join Code')).toBeVisible();
    
    // Verify session controls are present
    await expect(page.locator('button:has-text("End Session")')).toBeVisible();
    await expect(page.locator('button:has-text("Leave Session")')).toBeVisible();
    
    // Verify section name is displayed
    await expect(page.getByText(testSection.name)).toBeVisible({ timeout: 5000 });
    
    // Verify we're in the active session view with controls
    await expect(page.locator('button:has-text("End Session")')).toBeVisible();
    await expect(page.locator('button:has-text("Leave Session")')).toBeVisible();
  });

  test('should handle multiple sessions correctly', async ({ page }) => {
    // Create first session
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await problemCard.locator('button:has-text("Create Session")').click();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(500);
    await page.selectOption('select#section', testSection.id);
    await page.locator('button:has-text("Create Session")').last().click({ force: true });
    
    await expect(page.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });
    
    // Set up dialog handler BEFORE clicking end button
    page.once('dialog', async dialog => {
      await dialog.accept();
    });
    
    // End the first session
    const endButton = page.locator('button:has-text("End Session")');
    await endButton.click();
    
    await page.waitForTimeout(1000);
    
    // Create a second problem for variety
    const secondProblem = await createTestProblem(
      page,
      instructorUser.id,
      'Palindrome Checker',
      'Check if a string is a palindrome',
      'def is_palindrome(s):\n    pass'
    );
    
    // Navigate to problems and create another session
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    const secondProblemCard = page.locator(`div:has-text("${secondProblem.title}")`).first();
    await secondProblemCard.locator('button:has-text("Create Session")').first().click();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(500);
    await page.selectOption('select#section', testSection.id);
    await page.locator('button:has-text("Create Session")').last().click({ force: true });
    
    await expect(page.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });
    
    // Now navigate to sessions view to see all sessions
    await page.click('button:has-text("Sessions")');
    await expect(page.locator('h2').filter({ hasText: /Active Sessions|Your Sessions/ })).toBeVisible({ timeout: 10000 });
    
    // Verify we can see some session controls/indicators (at least one session should be visible)
    await expect(page.locator('button').filter({ hasText: /Rejoin|End Session|View Details/ }).first()).toBeVisible({ timeout: 5000 });
  });
});
