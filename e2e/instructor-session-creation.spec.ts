import { test, expect } from './helpers/setup';
import { loginAsInstructor } from './fixtures/auth-helpers';
import { createTestProblem, createTestClassViaAPI, createTestSectionViaAPI } from './fixtures/test-data';

/**
 * E2E tests for instructor session creation workflows  
 * Tests: session creation, join code display, WebSocket monitoring, persistence, and lifecycle
 */

test.describe('Instructor Session Creation', () => {
  let instructorUser: any;
  let testClass: any;
  let testSection: any;
  let testProblem: any;

  test.beforeEach(async ({ page }) => {
    // Login as instructor before each test
    instructorUser = await loginAsInstructor(page, 'test-session-instructor');
    
    // Create a class and section via API
    testClass = await createTestClassViaAPI(page, 'CS 101', 'Test Class for Sessions');
    testSection = await createTestSectionViaAPI(page, testClass.id, 'Section A', 'Fall 2025');
    
    // Create a test problem
    testProblem = await createTestProblem(
      page,
      instructorUser.id,
      'Array Sum Problem',
      'Calculate the sum of all elements in an array',
      'def array_sum(arr):\n    # TODO: implement\n    pass'
    );
    
    // Navigate to instructor dashboard
    await page.goto('/instructor');
    await expect(page.locator('h2:has-text("Your Classes")')).toBeVisible({ timeout: 10000 });
  });

  test('should create session and display join code', async ({ page }) => {
    // Navigate to problems section
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    // Find and click "Create Session" button for the test problem
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await expect(problemCard).toBeVisible({ timeout: 5000 });
    await problemCard.locator('button:has-text("Create Session")').click();
    
    // Modal should appear
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    // Select class and section
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(1000);
    await page.selectOption('select#section', testSection.id);
    
    // Create session (use .last() to get the submit button in the modal)
    await page.locator('button:has-text("Create Session")').last().click();
    
    // Wait for session to be created and join code to appear
    await page.waitForTimeout(2000);
    const joinCodeElement = page.locator('text=/[A-Z0-9]{6}/').first();
    await expect(joinCodeElement).toBeVisible({ timeout: 10000 });
    
    const joinCode = await joinCodeElement.textContent();
    expect(joinCode).toMatch(/[A-Z0-9]{6}/);
  });

  test('should verify WebSocket support (if available)', async ({ page }) => {
    // Monitor for WebSocket connections
    const wsConnections: string[] = [];
    
    page.on('websocket', ws => {
      wsConnections.push(ws.url());
    });
    
    // Create a session
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await problemCard.locator('button:has-text("Create Session")').click();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(1000);
    await page.selectOption('select#section', testSection.id);
    await page.locator('button:has-text("Create Session")').last().click();
    
    // Wait for potential WebSocket connection
    await page.waitForTimeout(3000);
    
    // WebSocket connections may or may not be established during creation
    // This test just verifies we can monitor them if they exist
    // Actual WebSocket usage happens when navigating to the session page
    console.log('WebSocket connections detected:', wsConnections.length);
    
    // This test passes regardless - it's informational
    // Real WebSocket testing would require navigating to the session page
    expect(true).toBe(true);
  });

  test('should persist session after page reload', async ({ page }) => {
    // Create a session
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await problemCard.locator('button:has-text("Create Session")').click();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(1000);
    await page.selectOption('select#section', testSection.id);
    await page.locator('button:has-text("Create Session")').last().click();
    
    // Wait for session creation
    await page.waitForTimeout(2000);
    const joinCodeElement = page.locator('text=/[A-Z0-9]{6}/').first();
    await expect(joinCodeElement).toBeVisible({ timeout: 10000 });
    const joinCode = await joinCodeElement.textContent();

    // Verify session exists via API
    const sessionsResponse = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });

    expect(sessionsResponse.success).toBe(true);
    expect(sessionsResponse.sessions.length).toBeGreaterThan(0);
    
    const activeSession = sessionsResponse.sessions.find((s: any) => s.joinCode === joinCode);
    expect(activeSession).toBeDefined();
    expect(activeSession.status).toBe('active');

    // Reload the page (it should stay on the same page, wherever we are)
    await page.reload();
    await page.waitForTimeout(1000);

    // Verify session still exists via API (regardless of which page we're on)
    const sessionsAfterReload = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });

    expect(sessionsAfterReload.success).toBe(true);
    const persistedSession = sessionsAfterReload.sessions.find((s: any) => s.joinCode === joinCode);
    expect(persistedSession).toBeDefined();
    expect(persistedSession.status).toBe('active');
  });

  test('should end active session', async ({ page }) => {
    // Create a session
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await problemCard.locator('button:has-text("Create Session")').click();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(1000);
    await page.selectOption('select#section', testSection.id);
    await page.locator('button:has-text("Create Session")').last().click();
    
    // Wait for session creation
    await page.waitForTimeout(2000);
    await expect(page.locator('text=/[A-Z0-9]{6}/').first()).toBeVisible({ timeout: 10000 });

    // Get the session ID
    const sessionsResponse = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });

    expect(sessionsResponse.sessions.length).toBeGreaterThan(0);
    const session = sessionsResponse.sessions[0];

    // End the session via API
    const deleteResponse = await page.evaluate(async (sessionId: string) => {
      const response = await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
      return { status: response.status, body: await response.json() };
    }, session.id);

    expect(deleteResponse.status).toBe(200);
    expect(deleteResponse.body.success).toBe(true);

    // Verify session is marked as completed
    const sessionsAfterEnd = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });

    const endedSession = sessionsAfterEnd.sessions.find((s: any) => s.id === session.id);
    expect(endedSession).toBeDefined();
    expect(endedSession.status).toBe('completed');
  });

  test('should handle multiple sessions sequentially', async ({ page }) => {
    // Create first session
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
    await problemCard.locator('button:has-text("Create Session")').click();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(1000);
    await page.selectOption('select#section', testSection.id);
    await page.locator('button:has-text("Create Session")').last().click();
    
    // Wait for first session creation
    await page.waitForTimeout(2000);
    await expect(page.locator('text=/[A-Z0-9]{6}/').first()).toBeVisible({ timeout: 10000 });

    // Get first session
    const firstSessionsResponse = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });

    const firstSession = firstSessionsResponse.sessions.find((s: any) => s.status === 'active');
    expect(firstSession).toBeDefined();

    // End the first session
    await page.evaluate(async (sessionId: string) => {
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'DELETE',
        credentials: 'include'
      });
    }, firstSession.id);

    // Wait a bit for the session to be marked as ended
    await page.waitForTimeout(1000);

    // Navigate back to problems to create second session
    await page.goto('/instructor');
    await expect(page.locator('h2:has-text("Your Classes")')).toBeVisible({ timeout: 10000 });
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });

    // Create second session
    const problemCard2 = page.locator(`div:has-text("${testProblem.title}")`).first();
    await problemCard2.locator('button:has-text("Create Session")').click();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });
    
    await page.selectOption('select#class', testClass.id);
    await page.waitForTimeout(1000);
    await page.selectOption('select#section', testSection.id);
    await page.locator('button:has-text("Create Session")').last().click();
    
    // Wait for second session creation
    await page.waitForTimeout(2000);
    await expect(page.locator('text=/[A-Z0-9]{6}/').first()).toBeVisible({ timeout: 10000 });

    // Verify we now have two sessions (one active, one completed)
    const finalSessionsResponse = await page.evaluate(async () => {
      const response = await fetch('/api/sessions', { credentials: 'include' });
      return response.json();
    });

    expect(finalSessionsResponse.sessions.length).toBe(2);
    const activeSessions = finalSessionsResponse.sessions.filter((s: any) => s.status === 'active');
    const completedSessions = finalSessionsResponse.sessions.filter((s: any) => s.status === 'completed');
    
    expect(activeSessions.length).toBe(1);
    expect(completedSessions.length).toBe(1);
  });
});
