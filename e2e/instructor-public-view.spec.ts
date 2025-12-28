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
 * Helper: Creates a session and returns join code
 */
async function createSession(
  page: Page, 
  testClass: any, 
  testSection: any, 
  testProblem: any
): Promise<string> {
  await page.goto('/instructor');
  await expect(page.locator('h2:has-text("Your Classes")')).toBeVisible({ timeout: 10000 });
  
  // Navigate to problems
  await page.click('button:has-text("Problems")');
  await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
  
  // Find and click "Create Session" for the test problem
  const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
  await expect(problemCard).toBeVisible({ timeout: 5000 });
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
  const joinCode = (await joinCodeElement.textContent()) || '';
  return joinCode;
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
  
  // Join session
  await studentPage.goto('/student');
  await studentPage.click('button:has-text("Join New Session")');
  await studentPage.fill('input[placeholder="ABC123"]', joinCode);
  await studentPage.click('button:has-text("Join Session")');
  await studentPage.waitForTimeout(2000);
  
  // Wait for editor to load and submit code
  const monacoEditor = studentPage.locator('.monaco-editor').first();
  await expect(monacoEditor).toBeVisible({ timeout: 5000 });
  
  // Write code in Monaco editor
  await studentPage.evaluate((codeToSet) => {
    const model = (window as any).monaco.editor.getModels()[0];
    model.setValue(codeToSet);
  }, code);
  
  // Wait for code to be saved
  await studentPage.waitForTimeout(1000);
  
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
    const joinCode = await createSession(page, testClass, testSection, testProblem);
    
    // Get sessionId from API
    await page.waitForTimeout(2000);
    const sessionsData = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });
    
    const activeSession = sessionsData.sessions.find((s: any) => s.joinCode === joinCode);
    const sessionId = activeSession.id;
    
    // Open public view in a new page
    const publicViewUrl = `/instructor/public?sessionId=${sessionId}`;
    await page.goto(publicViewUrl);
    
    // Verify public view loads
    await expect(page.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 10000 });
    
    // Wait for WebSocket to connect and send data (join code should appear)
    await expect(page.locator('text=/[A-Z0-9]{6}/')).toBeVisible({ timeout: 10000 });
    
    // Verify problem section is displayed
    await expect(page.locator('h2:has-text("Problem")')).toBeVisible({ timeout: 5000 });
    
    // Verify empty state message (no submission selected)
    await expect(page.locator('text=No submission selected for display')).toBeVisible({ timeout: 5000 });
  });

  test('should display featured submission when selected by instructor', async ({ page, context }) => {
    // Create session
    const joinCode = await createSession(page, testClass, testSection, testProblem);
    
    // Get session ID from API
    await page.waitForTimeout(2000);
    const sessionsData = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });
    
    const activeSession = sessionsData.sessions.find((s: any) => s.joinCode === joinCode);
    const sessionId = activeSession.id;
    
    // Have a student join and submit code
    const studentCode = 'def array_sum(arr):\n    return sum(arr)';
    const studentPage = await studentJoinAndSubmit(context, joinCode, 'alice-public-test', studentCode);
    
    // Open public view FIRST
    const publicPage = await context.newPage();
    await publicPage.goto(`/instructor/public?sessionId=${sessionId}`);
    
    // Wait for public view to load and WebSocket to connect
    await expect(publicPage.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 10000 });
    await expect(publicPage.locator('text=/[A-Z0-9]{6}/')).toBeVisible({ timeout: 10000 });
    
    // Now switch to instructor page and select student to display on public view
    await page.bringToFront();
    await page.waitForTimeout(3000); // Wait for student to appear in list
    
    // Click "Show on Public View" button for the student
    const showOnPublicViewButton = page.locator('button:has-text("Show on Public View")').first();
    await expect(showOnPublicViewButton).toBeVisible({ timeout: 10000 });
    await showOnPublicViewButton.click();
    
    // Switch back to public page and wait for update
    await publicPage.bringToFront();
    await publicPage.waitForTimeout(2000);
    
    // Verify public view shows featured submission
    await expect(publicPage.locator('h2:has-text("Featured Submission")')).toBeVisible({ timeout: 10000 });
    
    // Verify code is displayed (look for the actual code content)
    await expect(publicPage.locator('text=return sum(arr)')).toBeVisible({ timeout: 10000 });
    
    // Cleanup
    await studentPage.close();
    await publicPage.close();
  });

  test('should show latest submission when student submits multiple times', async ({ page, context }) => {
    // Create session
    const joinCode = await createSession(page, testClass, testSection, testProblem);
    
    // Get session ID from API
    await page.waitForTimeout(2000);
    const sessionsData = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });
    
    const activeSession = sessionsData.sessions.find((s: any) => s.joinCode === joinCode);
    const sessionId = activeSession.id;
    
    // Have a student join
    const studentPage = await context.newPage();
    await loginAsStudent(studentPage, 'bob-multiple-submissions');
    await studentPage.goto('/student');
    await studentPage.click('button:has-text("Join New Session")');
    await studentPage.fill('input[placeholder="ABC123"]', joinCode);
    await studentPage.click('button:has-text("Join Session")');
    await studentPage.waitForTimeout(2000);
    
    // Submit first version of code
    const monacoEditor = studentPage.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible({ timeout: 5000 });
    
    await studentPage.evaluate(() => {
      const model = (window as any).monaco.editor.getModels()[0];
      model.setValue('def array_sum(arr):\n    return 0  # First version');
    });
    await studentPage.waitForTimeout(1000);
    
    // Submit second version of code
    await studentPage.evaluate(() => {
      const model = (window as any).monaco.editor.getModels()[0];
      model.setValue('def array_sum(arr):\n    return sum(arr)  # Final version');
    });
    await studentPage.waitForTimeout(1000);
    
    // Switch to instructor and show submission on public view
    await page.bringToFront();
    await page.waitForTimeout(2000);
    
    const showOnPublicViewButton = page.locator('button:has-text("Show on Public View")').first();
    await expect(showOnPublicViewButton).toBeVisible({ timeout: 10000 });
    await showOnPublicViewButton.click();
    
    // Open public view and verify it shows the latest code
    const publicPage = await context.newPage();
    await publicPage.goto(`/instructor/public?sessionId=${sessionId}`);
    
    await expect(publicPage.locator('h2:has-text("Featured Submission")')).toBeVisible({ timeout: 10000 });
    
    // Verify latest code is shown (not the first version)
    await expect(publicPage.locator('text=Final version')).toBeVisible({ timeout: 10000 });
    
    // Verify old version is NOT shown
    const firstVersionText = await publicPage.locator('text=First version').count();
    expect(firstVersionText).toBe(0);
    
    // Cleanup
    await studentPage.close();
    await publicPage.close();
  });

  test('should display multiple student submissions when multiple students join', async ({ page, context }) => {
    // Create session
    const joinCode = await createSession(page, testClass, testSection, testProblem);
    
    // Get session ID from API
    await page.waitForTimeout(2000);
    const sessionsData = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });
    
    const activeSession = sessionsData.sessions.find((s: any) => s.joinCode === joinCode);
    const sessionId = activeSession.id;
    
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
    const charlieButton = page.locator('div:has-text("charlie-multi")').locator('button:has-text("Show on Public View")').first();
    await charlieButton.click();
    
    // Switch to public page and verify charlie's code
    await publicPage.bringToFront();
    await publicPage.waitForTimeout(500); // Brief wait for WebSocket update to arrive
    await expect(publicPage.locator('h2:has-text("Featured Submission")')).toBeVisible({ timeout: 10000 });
    await expect(publicPage.locator('text=for x in arr')).toBeVisible({ timeout: 10000 });
    
    // Switch to diana's code
    await page.bringToFront();
    const dianaButton = page.locator('div:has-text("diana-multi")').locator('button:has-text("Show on Public View")').first();
    await dianaButton.click();
    
    // Verify public view updates to diana's code
    await publicPage.bringToFront();
    await publicPage.waitForTimeout(500); // Brief wait for WebSocket update to arrive
    await expect(publicPage.locator('h2:has-text("Featured Submission")')).toBeVisible({ timeout: 10000 });
    await expect(publicPage.locator('text=return sum(arr)')).toBeVisible({ timeout: 10000 });
    
    // Cleanup
    await student1Page.close();
    await student2Page.close();
    await publicPage.close();
  });

  test('should handle public view with no session ID gracefully', async ({ page }) => {
    // Navigate to public view without sessionId
    await page.goto('/instructor/public');
    
    // Verify error/empty state is shown
    await expect(page.locator('h1:has-text("No Session")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Please provide a sessionId in the URL')).toBeVisible({ timeout: 5000 });
  });

  test('should verify WebSocket connection for real-time public view updates', async ({ page, context }) => {
    // Create session
    const joinCode = await createSession(page, testClass, testSection, testProblem);
    
    // Get session ID from API
    await page.waitForTimeout(2000);
    const sessionsData = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });
    
    const activeSession = sessionsData.sessions.find((s: any) => s.joinCode === joinCode);
    const sessionId = activeSession.id;
    
    // Open public view and monitor WebSocket connections
    const publicPage = await context.newPage();
    const wsConnections: any[] = [];
    
    publicPage.on('websocket', ws => {
      wsConnections.push(ws);
      console.log('WebSocket connection detected:', ws.url());
    });
    
    await publicPage.goto(`/instructor/public?sessionId=${sessionId}`);
    
    // Wait for WebSocket connection to establish
    await publicPage.waitForTimeout(3000);
    
    // Verify WebSocket connection was established
    expect(wsConnections.length).toBeGreaterThan(0);
    
    // Verify public view loaded correctly
    await expect(publicPage.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 10000 });
    
    // Have a student join and submit code
    const studentPage = await studentJoinAndSubmit(
      context, 
      joinCode, 
      'eve-websocket-test', 
      'def array_sum(arr):\n    return sum(arr)'
    );
    
    // Show submission on public view via instructor page
    await page.bringToFront();
    await page.waitForTimeout(2000);
    
    const showButton = page.locator('button:has-text("Show on Public View")').first();
    await expect(showButton).toBeVisible({ timeout: 10000 });
    await showButton.click();
    
    // Switch to public view and verify it updates in real-time via WebSocket
    await publicPage.bringToFront();
    await publicPage.waitForTimeout(2000);
    
    // Verify featured submission appears (real-time update via WebSocket)
    await expect(publicPage.locator('h2:has-text("Featured Submission")')).toBeVisible({ timeout: 10000 });
    await expect(publicPage.locator('text=return sum(arr)')).toBeVisible({ timeout: 10000 });
    
    // Cleanup
    await studentPage.close();
    await publicPage.close();
  });
});
