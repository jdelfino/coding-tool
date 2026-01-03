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
import { Page, Browser, BrowserContext } from '@playwright/test';
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
 * Returns both the student page and context for proper cleanup
 */
async function studentJoinAndSubmit(
  browser: Browser,
  joinCode: string,
  studentName: string,
  code: string,
  problemTitle: string
): Promise<{ page: Page; context: BrowserContext }> {
  // Create a new isolated context for the student to avoid cookie sharing
  const studentContext = await browser.newContext();
  const studentPage = await studentContext.newPage();
  await loginAsStudent(studentPage, studentName);
  
  // Wait for auth to fully settle after login
  await studentPage.waitForTimeout(1000);

  // Navigate to sections page
  await studentPage.goto('/sections');
  await expect(studentPage.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

  // Click join section button
  await studentPage.click('button:has-text("Join Section"), button:has-text("Join Your First Section")');
  await expect(studentPage.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });

  // Enter join code and join
  await studentPage.fill('input#joinCode', joinCode);
  await studentPage.click('button:has-text("Join Section")');

  // Wait for redirect back to sections page
  await expect(studentPage.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

  // Wait for active session to appear and join it
  const joinNowButton = studentPage.locator('button:has-text("Join Now")');
  await expect(joinNowButton).toBeVisible({ timeout: 5000 });

  await joinNowButton.click();

  // Wait for navigation to student page
  await studentPage.waitForURL(/\/student\?sessionId=/, { timeout: 5000 });

  // Wait for session to load AND for the student to be fully joined (SESSION_JOINED message received)
  // CRITICAL: Check what's actually on the page before looking for Leave Session button
  const pageDebug = await studentPage.evaluate(() => {
    const bodyText = document.body.textContent || '';
    return {
      url: window.location.href,
      title: document.title,
      h1Text: document.querySelector('h1')?.textContent || 'NO_H1',
      signedInText: bodyText.match(/Signed in as\s+(\S+)/)?.[1] || 'NO_SIGNED_IN_TEXT',
      hasLeaveButton: bodyText.includes('Leave Session'),
      bodySnippet: bodyText.substring(0, 300).replace(/\s+/g, ' ')
    };
  });
  console.log('📊 Page state before looking for Leave Session button:', JSON.stringify(pageDebug, null, 2));

  // If we're seeing the instructor dashboard, this is the bug
  if (pageDebug.h1Text?.includes('Instructor')) {
    throw new Error(`🐛 BUG REPRODUCED! Student page is showing Instructor Dashboard. URL: ${pageDebug.url}, User shown: ${pageDebug.signedInText}`);
  }

  await expect(studentPage.locator('button:has-text("Leave Session")')).toBeVisible({ timeout: 5000 });
  console.log('Leave Session button visible, student has joined');

  // Debug: Check what's on the page
  const htmlContent = await studentPage.content();
  console.log('Student page URL after join:', studentPage.url());
  console.log('Student page title:', await studentPage.title());

  // CRITICAL: Wait for problem to be loaded before expecting Monaco
  // The problem must be received via WebSocket (SESSION_JOINED or PROBLEM_UPDATE) before Monaco renders
  console.log('Waiting for problem to load...');
  await expect(studentPage.locator('h2, h3').filter({ hasText: problemTitle })).toBeVisible({ timeout: 15000 });
  console.log('Problem loaded!');

  // CRITICAL: Check if student is still on the /student page (not redirected to /sections)
  let currentUrl = studentPage.url();
  if (!currentUrl.includes('/student?sessionId=')) {
    throw new Error(`Student was REDIRECTED after problem loaded! Current URL: ${currentUrl}`);
  }
  console.log('Student still on /student page after problem load');

  // Wait a moment for React to render
  await studentPage.waitForTimeout(500);

  // Check URL again before looking for Monaco
  currentUrl = studentPage.url();
  console.log('URL after 500ms wait:', currentUrl);
  if (!currentUrl.includes('/student?sessionId=')) {
    // Try to understand what triggered the redirect
    const pageText = await studentPage.evaluate(() => document.body.innerText);
    console.log('Page text after redirect:', pageText.substring(0, 500));
    throw new Error(`Student was REDIRECTED before Monaco check! Current URL: ${currentUrl}`);
  }

  const monacoEditor = studentPage.locator('.monaco-editor').first();

  await expect(monacoEditor).toBeVisible({ timeout: 10000 });
  console.log('Monaco editor is visible');

  // Wait for Monaco model to be ready - use a more lenient check
  // Sometimes the model takes time to initialize, especially with HMR
  await studentPage.waitForFunction(() => {
    const monaco = (window as any).monaco;
    if (!monaco || !monaco.editor) return false;
    const models = monaco.editor.getModels();
    console.log('Monaco models count:', models?.length || 0);
    return models && models.length > 0;
  }, { timeout: 15000 }); // Increased timeout

  console.log('Monaco model ready');

  // Wait a bit more for the editor to be fully interactive
  await studentPage.waitForTimeout(500);

  // Click in the editor to focus it
  await monacoEditor.click({ force: true });

  // Select all existing content and replace with new code using keyboard
  // Add delay to prevent missing characters when typing fast
  await studentPage.keyboard.press('Control+A');
  await studentPage.keyboard.type(code, { delay: 50 });

  // Wait for debounced code save (500ms debounce) + extra time for server processing
  // With 50ms delay per character, a 40-char code takes ~2s to type, then 500ms debounce, then server processing
  // So we need to wait at least 3 seconds total
  await studentPage.waitForTimeout(3000);

  // CRITICAL: Verify student is still in session and code was set correctly
  // This check ensures the test fails fast if the student got redirected or code wasn't saved
  currentUrl = studentPage.url();
  if (!currentUrl.includes('/student?sessionId=')) {
    throw new Error(`Student was redirected away from session! Current URL: ${currentUrl}`);
  }
  console.log('Student still in session, URL:', currentUrl);

  // Verify the code was actually set in Monaco
  const actualCode = await studentPage.evaluate(() => {
    const models = (window as any).monaco?.editor?.getModels();
    if (!models || models.length === 0) return null;
    return models[0].getValue();
  });

  if (!actualCode) {
    throw new Error('Monaco editor has no content - code was not set!');
  }

  if (!actualCode.includes('return sum(arr)')) {
    throw new Error(`Code was not set correctly in Monaco! Expected to include "return sum(arr)", but got: ${actualCode}`);
  }

  console.log('Code verified in Monaco:', actualCode);

  return { page: studentPage, context: studentContext };
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

  test('should display featured submission when selected by instructor', async ({ page, browser }) => {
    // Create session
    const { sessionId, joinCode } = await createSession(page, testClass, testSection, testProblem);

    // Have a student join and submit code
    const studentCode = 'def array_sum(arr):\n    return sum(arr)';
    const { page: studentPage, context: studentContext } = await studentJoinAndSubmit(
      browser,
      joinCode,
      'alice-public-test',
      studentCode,
      testProblem.title
    );

    // Open public view in a separate context (can use instructor's context)
    const publicPage = await page.context().newPage();
    await publicPage.goto(`/instructor/public?sessionId=${sessionId}`);

    // Wait for public view to load and WebSocket to connect
    await expect(publicPage.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 5000 });
    await expect(publicPage.locator('text=/[A-Z0-9]{6}/')).toBeVisible({ timeout: 5000 });

    // Now switch to instructor page and wait for student to appear
    await page.bringToFront();

    // Switch to Student Code tab
    await page.click('button:has-text("Student Code")');

    await expect(page.locator('text=alice-public-test')).toBeVisible({ timeout: 5000 });

    // Verify the student shows "Has code" before viewing
    await expect(page.locator('text=alice-public-test').locator('..').locator('text=✓ Has code')).toBeVisible({ timeout: 5000 });

    // Click "View Code" to load the student's code in the embedded editor
    await page.locator('button:has-text("View Code")').first().click();

    // Wait for the student code section to appear
    await expect(page.locator('h3:has-text("alice-public-test\'s Code")')).toBeVisible({ timeout: 5000 });

    // Wait for Monaco editor in the student code section to load
    const studentCodeSection = page.locator('div:has(h3:has-text("alice-public-test\'s Code"))');
    await expect(studentCodeSection.locator('.monaco-editor')).toBeVisible({ timeout: 5000 });

    // Debug: Get actual monaco content
    const actualCode = await page.evaluate(() => {
      const models = (window as any).monaco?.editor?.getModels();
      if (!models || models.length === 0) return 'NO_MODELS';
      // Get all models' content to see what we have
      return models.map((m: any, i: number) => `Model ${i}: ${m.getValue()}`).join('\n---\n');
    });
    console.log('ACTUAL MONACO CONTENT:', actualCode);

    // Wait for the student's code to appear in the student code editor (not the problem editor)
    await expect(studentCodeSection.locator('text=return sum(arr)')).toBeVisible({ timeout: 5000 });

    const showOnPublicViewButton = page.locator('button:has-text("Show on Public View")').first();
    await expect(showOnPublicViewButton).toBeVisible({ timeout: 5000 });
    await showOnPublicViewButton.click();

    // Switch back to public page and verify update
    await publicPage.bringToFront();

    // Wait for WebSocket message to propagate - give it more time
    await publicPage.waitForTimeout(1000);

    // Verify public view shows featured submission - check for the code first as it's most reliable
    // The heading might not be present if the UI structure changes, but the code content is essential
    await expect(publicPage.locator('text=return sum(arr)')).toBeVisible({ timeout: 10000 });

    // Verify the Monaco editor is present showing the featured submission
    await expect(publicPage.locator('.monaco-editor')).toBeVisible({ timeout: 5000 });

    // Cleanup
    await studentPage.close();
    await publicPage.close();
    await studentContext.close();
  });

  test('should show latest submission when student submits multiple times', async ({ page, browser }) => {
    // Create session
    const { sessionId, joinCode } = await createSession(page, testClass, testSection, testProblem);

    // Have a student join - create new context for isolated authentication
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
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
    const publicPage = await page.context().newPage();
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
    await studentContext.close();
  });

  test('should display multiple student submissions when multiple students join', async ({ page, browser }) => {
    // Create session
    const { sessionId, joinCode } = await createSession(page, testClass, testSection, testProblem);

    // Have multiple students join and submit code
    const { page: student1Page, context: student1Context } = await studentJoinAndSubmit(
      browser,
      joinCode,
      'charlie-multi',
      'def array_sum(arr):\n    result = 0\n    for x in arr:\n        result += x\n    return result',
      testProblem.title
    );

    const { page: student2Page, context: student2Context } = await studentJoinAndSubmit(
      browser,
      joinCode,
      'diana-multi',
      'def array_sum(arr):\n    return sum(arr)',
      testProblem.title
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
    const publicPage = await page.context().newPage();
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
    await student1Context.close();
    await student2Context.close();
  });

  test('should handle public view with no session ID gracefully', async ({ page }) => {
    // Navigate to public view without sessionId
    await page.goto('/instructor/public');

    // Verify error/empty state is shown
    await expect(page.locator('h1:has-text("No Session")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Please provide a sessionId in the URL')).toBeVisible({ timeout: 5000 });
  });

  test('should verify WebSocket connection for real-time public view updates', async ({ page, browser }) => {
    // Create session
    const { sessionId, joinCode } = await createSession(page, testClass, testSection, testProblem);

    // Open public view and monitor WebSocket connections
    const publicPage = await page.context().newPage();
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
    const { page: studentPage, context: studentContext } = await studentJoinAndSubmit(
      browser,
      joinCode,
      'eve-websocket-test',
      'def array_sum(arr):\n    return sum(arr)',
      testProblem.title
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
    await studentContext.close();
  });
});
