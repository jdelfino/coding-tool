/**
 * E2E tests for instructor public view (displaying student code)
 * @see coding-tool-diq.4
 *
 * These tests verify the public view functionality used for classroom projection:
 * - Displaying student submissions
 * - Real-time updates when students submit code
 * - Empty state handling
 * - Featured submission selection and display
 */

import { test, expect } from './helpers/setup';
import { Page, BrowserContext } from '@playwright/test';
import { loginAsInstructor, loginAsStudent } from './fixtures/auth-helpers';
import {
  createTestProblem,
  createTestClassViaAPI,
  createTestSectionViaAPI
} from './fixtures/test-data';

/**
 * Helper: Creates a session and returns session ID and section join code
 */
async function createSession(
  page: Page,
  testClass: any,
  testSection: any,
  testProblem: any
): Promise<{ sessionId: string; joinCode: string }> {
  await page.goto('/instructor');
  await expect(page.locator('h2:has-text("Your Classes")')).toBeVisible({ timeout: 5000 });

  // Navigate to problems
  await page.click('button:has-text("Problems")');
  await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 5000 });

  // Find and click "Create Session" for the test problem
  const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
  await expect(problemCard).toBeVisible({ timeout: 5000 });
  await problemCard.locator('button:has-text("Create Session")').first().click({ force: true });

  // Modal should appear
  await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });

  // Select class and section
  await page.selectOption('select#class', testClass.id);
  await page.selectOption('select#section', testSection.id);

  // Click the "Create Session" button in the modal (use last() to get the submit button)
  await page.locator('button:has-text("Create Session")').last().click();

  // Wait for session to be created - check for Active Session header
  await expect(page.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 5000 });

  // Get session ID from the API (sessions don't have join codes anymore)
  const sessionsData = await page.evaluate(async () => {
    const response = await fetch('/api/sessions', { credentials: 'include' });
    return response.json();
  });

  // Find the active session for this section
  const activeSession = sessionsData.sessions.find((s: any) =>
    s.sectionId === testSection.id && s.status === 'active'
  );

  if (!activeSession) {
    throw new Error('Could not find active session');
  }

  // Join code comes from the section, not the session
  return { sessionId: activeSession.id, joinCode: testSection.joinCode };
}

/**
 * Helper: Student joins session and submits code
 */
async function studentJoinAndSubmit(
  context: BrowserContext,
  joinCode: string,
  studentName: string,
  code: string
): Promise<Page> {
  const studentPage = await context.newPage();
  await loginAsStudent(studentPage, studentName);

  // Navigate to sections page
  await studentPage.goto('/sections');
  await expect(studentPage.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 10000 });

  // Click join section button
  await studentPage.click('button:has-text("Join Section"), button:has-text("Join Your First Section")');
  await expect(studentPage.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });

  // Enter join code and join
  await studentPage.fill('input#joinCode', joinCode);
  await studentPage.click('button:has-text("Join Section")');

  // Wait for redirect back to sections page
  await expect(studentPage.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 10000 });

  // Wait for active session to appear and join it
  await expect(studentPage.locator('button:has-text("Join Now")')).toBeVisible({ timeout: 5000 });
  await studentPage.click('button:has-text("Join Now")');

  // Wait for session to load
  await expect(studentPage.locator('h1:has-text("Live Coding Session")')).toBeVisible({ timeout: 10000 });

  // Wait for Monaco editor to load
  const monacoEditor = studentPage.locator('.monaco-editor').first();
  await expect(monacoEditor).toBeVisible({ timeout: 5000 });

  // Write code in Monaco editor
  await studentPage.evaluate((codeToSet) => {
    const model = (window as any).monaco.editor.getModels()[0];
    model.setValue(codeToSet);
  }, code);

  // Wait for code to be saved
  await studentPage.waitForTimeout(300);

  return studentPage;
}

test.describe('Instructor Public View', () => {
  let instructorUser: any;
  let testClass: any;
  let testSection: any;
  let testProblem: any;

  test.beforeEach(async ({ page }) => {
    // Setup instructor and create test data
    instructorUser = await loginAsInstructor(page, 'test-public-view-instructor');

    // Create class and section via API
    testClass = await createTestClassViaAPI(page, 'CS 101', 'Test Class for Public View');
    testSection = await createTestSectionViaAPI(page, testClass.id, 'Section A', 'Fall 2025');

    // Create a test problem
    testProblem = await createTestProblem(
      page,
      instructorUser.id,
      'Array Sum Problem',
      'Calculate the sum of all elements in an array',
      'def array_sum(arr):\n    # TODO: implement\n    pass'
    );
  });

  test('should display public view with no featured submission (empty state)', async ({ page }) => {
    // Create session
    const { sessionId, joinCode } = await createSession(page, testClass, testSection, testProblem);

    // Open public view in a new page
    const publicViewUrl = `/instructor/public?sessionId=${sessionId}`;
    await page.goto(publicViewUrl);

    // Verify public view loads
    await expect(page.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 5000 });

    // Wait for WebSocket to connect and send data (join code should appear)
    await expect(page.locator('text=/[A-Z0-9]{6}/')).toBeVisible({ timeout: 5000 });

    // Verify problem section is displayed
    await expect(page.locator('h2:has-text("Problem")')).toBeVisible({ timeout: 5000 });

    // Verify empty state message (no submission selected)
    await expect(page.locator('text=No submission selected for display')).toBeVisible({ timeout: 5000 });
  });

  test('should display featured submission when selected by instructor', async ({ page, context }) => {
    // Create session
    const { sessionId, joinCode } = await createSession(page, testClass, testSection, testProblem);

    // Have a student join and submit code
    const studentCode = 'def array_sum(arr):\n    return sum(arr)';
    const studentPage = await studentJoinAndSubmit(context, joinCode, 'alice-public-test', studentCode);

    // Open public view FIRST
    const publicPage = await context.newPage();
    await publicPage.goto(`/instructor/public?sessionId=${sessionId}`);

    // Wait for public view to load and WebSocket to connect
    await expect(publicPage.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 5000 });
    await expect(publicPage.locator('text=/[A-Z0-9]{6}/')).toBeVisible({ timeout: 5000 });

    // Now switch to instructor page and wait for student to appear
    await page.bringToFront();
    
    // Switch to Student Code tab
    await page.click('button:has-text("Student Code")');
    await page.waitForTimeout(500);
    
    await expect(page.locator('text=alice-public-test')).toBeVisible({ timeout: 10000 });

    // Click "Show on Public View" button for the student
    const showOnPublicViewButton = page.locator('button:has-text("Show on Public View")').first();
    await expect(showOnPublicViewButton).toBeVisible({ timeout: 5000 });
    await showOnPublicViewButton.click();

    // Switch back to public page and verify update
    await publicPage.bringToFront();

    // Verify public view shows featured submission
    await expect(publicPage.locator('h2:has-text("Featured Submission")')).toBeVisible({ timeout: 10000 });

    // Verify code is displayed (look for the actual code content)
    await expect(publicPage.locator('text=return sum(arr)')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await studentPage.close();
    await publicPage.close();
  });

  test('should show latest submission when student submits multiple times', async ({ page, context }) => {
    // Create session
    const { sessionId, joinCode } = await createSession(page, testClass, testSection, testProblem);

    // Have a student join
    const studentPage = await context.newPage();
    await loginAsStudent(studentPage, 'bob-multiple-submissions');

    // Navigate to sections and join
    await studentPage.goto('/sections');
    await expect(studentPage.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 10000 });
    await studentPage.click('button:has-text("Join Section"), button:has-text("Join Your First Section")');
    await expect(studentPage.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });
    await studentPage.fill('input#joinCode', joinCode);
    await studentPage.click('button:has-text("Join Section")');
    await expect(studentPage.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 10000 });
    await expect(studentPage.locator('button:has-text("Join Now")')).toBeVisible({ timeout: 5000 });
    await studentPage.click('button:has-text("Join Now")');
    await expect(studentPage.locator('h1:has-text("Live Coding Session")')).toBeVisible({ timeout: 10000 });

    // Submit first version of code
    const monacoEditor = studentPage.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible({ timeout: 5000 });

    await studentPage.evaluate(() => {
      const model = (window as any).monaco.editor.getModels()[0];
      model.setValue('def array_sum(arr):\n    return 0  # First version');
    });
    await studentPage.waitForTimeout(300);

    // Submit second version of code
    await studentPage.evaluate(() => {
      const model = (window as any).monaco.editor.getModels()[0];
      model.setValue('def array_sum(arr):\n    return sum(arr)  # Final version');
    });
    await studentPage.waitForTimeout(300);

    // Switch to instructor and wait for student to appear
    await page.bringToFront();
    
    // Switch to Student Code tab
    await page.click('button:has-text("Student Code")');
    await page.waitForTimeout(500);
    
    await expect(page.locator('text=bob-multiple-submissions')).toBeVisible({ timeout: 10000 });

    // Open public view BEFORE clicking button so it receives WebSocket update
    const publicPage = await context.newPage();
    await publicPage.goto(`/instructor/public?sessionId=${sessionId}`);
    await expect(publicPage.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 5000 });
    await expect(publicPage.locator('text=/[A-Z0-9]{6}/')).toBeVisible({ timeout: 5000 });

    // Now click the show button
    await page.bringToFront();
    const showOnPublicViewButton = page.locator('button:has-text("Show on Public View")').first();
    await showOnPublicViewButton.click();

    // Switch to public view and verify it received the update
    await publicPage.bringToFront();
    await expect(publicPage.locator('h2:has-text("Featured Submission")')).toBeVisible({ timeout: 5000 });

    // Verify latest code is shown (not the first version)
    await expect(publicPage.locator('text=Final version')).toBeVisible({ timeout: 5000 });

    // Verify old version is NOT shown
    const firstVersionText = await publicPage.locator('text=First version').count();
    expect(firstVersionText).toBe(0);

    // Cleanup
    await studentPage.close();
    await publicPage.close();
  });

  test('should display multiple student submissions when multiple students join', async ({ page, context }) => {
    // Create session
    const { sessionId, joinCode } = await createSession(page, testClass, testSection, testProblem);

    // Have multiple students join and submit code
    const student1Page = await studentJoinAndSubmit(
      context,
      joinCode,
      'charlie-multi',
      'def array_sum(arr):\n    result = 0\n    for x in arr:\n        result += x\n    return result'
    );

    const student2Page = await studentJoinAndSubmit(
      context,
      joinCode,
      'diana-multi',
      'def array_sum(arr):\n    return sum(arr)'
    );

    // Switch to instructor and verify both students appear
    await page.bringToFront();

    // Switch to Student Code tab
    await page.click('button:has-text("Student Code")');
    await page.waitForTimeout(500);
    
    // Verify both students are in the student list
    await expect(page.locator('text=charlie-multi')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=diana-multi')).toBeVisible({ timeout: 10000 });
    
    // Open public view first
    const publicPage = await context.newPage();
    await publicPage.goto(`/instructor/public?sessionId=${sessionId}`);
    await expect(publicPage.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 10000 });
    await expect(publicPage.locator('text=/[A-Z0-9]{6}/')).toBeVisible({ timeout: 10000 });

    // Show first student on public view
    await page.bringToFront();
    // Wait for charlie to be visible, then click his specific "Show on Public View" button
    // Since students are in order and charlie is first, we can use nth(0)
    const charlieSubmitButton = page.getByRole('button', { name: 'Show on Public View' }).nth(0);
    await charlieSubmitButton.click();

    // Switch to public page and verify charlie's code
    await publicPage.bringToFront();
    await expect(publicPage.locator('h2:has-text("Featured Submission")')).toBeVisible({ timeout: 5000 });
    await expect(publicPage.locator('text=for x in arr')).toBeVisible({ timeout: 5000 });

    // Switch to diana's code
    await page.bringToFront();

    // Diana is second, so use nth(1)
    const dianaSubmitButton = page.getByRole('button', { name: 'Show on Public View' }).nth(1);
    await dianaSubmitButton.click();

    // Verify public view updates to diana's code
    await publicPage.bringToFront();
    await expect(publicPage.locator('h2:has-text("Featured Submission")')).toBeVisible({ timeout: 5000 });
    await expect(publicPage.locator('text=return sum(arr)')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await student1Page.close();
    await student2Page.close();
    await publicPage.close();
  });

  test('should handle public view with no session ID gracefully', async ({ page }) => {
    // Navigate to public view without sessionId
    await page.goto('/instructor/public');

    // Verify error/empty state is shown
    await expect(page.locator('h1:has-text("No Session")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Please provide a sessionId in the URL')).toBeVisible({ timeout: 5000 });
  });

  test('should verify WebSocket connection for real-time public view updates', async ({ page, context }) => {
    // Create session
    const { sessionId, joinCode } = await createSession(page, testClass, testSection, testProblem);

    // Open public view and monitor WebSocket connections
    const publicPage = await context.newPage();
    const wsConnections: any[] = [];

    publicPage.on('websocket', ws => {
      wsConnections.push(ws);
      console.log('WebSocket connection detected:', ws.url());
    });

    await publicPage.goto(`/instructor/public?sessionId=${sessionId}`);

    // Verify public view loaded correctly and WebSocket connected
    await expect(publicPage.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 5000 });
    await expect(publicPage.locator('text=/[A-Z0-9]{6}/')).toBeVisible({ timeout: 5000 });

    // Verify WebSocket connection was established
    expect(wsConnections.length).toBeGreaterThan(0);

    // NOW have a student join and submit code (after public page is open)
    const studentPage = await studentJoinAndSubmit(
      context,
      joinCode,
      'eve-websocket-test',
      'def array_sum(arr):\n    return sum(arr)'
    );

    // Show submission on public view via instructor page
    await page.bringToFront();
    
    // Switch to Student Code tab
    await page.click('button:has-text("Student Code")');
    await page.waitForTimeout(500);
    
    await expect(page.locator('text=eve-websocket-test')).toBeVisible({ timeout: 10000 });

    // Check that student has code before proceeding
    await expect(page.locator('text=✓ Has code')).toBeVisible({ timeout: 5000 });

    // Click "Show on Public View" button for the student
    const showButton = page.locator('button:has-text("Show on Public View")').first();
    await expect(showButton).toBeVisible({ timeout: 5000 });
    await showButton.click();

    // Switch to public view and verify it updates in real-time via WebSocket
    await publicPage.bringToFront();

    // Verify featured submission appears (real-time update via WebSocket)
    await expect(publicPage.locator('h2:has-text("Featured Submission")')).toBeVisible({ timeout: 5000 });

    // Wait for Monaco editor to be present and visible
    await publicPage.waitForSelector('.monaco-editor', { state: 'visible', timeout: 5000 });

    // Verify the specific code content is visible
    await expect(publicPage.locator('text=return sum(arr)')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await studentPage.close();
    await publicPage.close();
  });
});
