/**
 * E2E test for WebSocket + Supabase Integration
 * @see coding-tool-kb3.18.1
 *
 * Validates that WebSocket handlers correctly persist to Supabase during live coding sessions.
 * Tests: basic persistence, concurrent students, disconnect/reconnect.
 *
 * Focus: End-to-end integration proving WebSocket → SessionManager → Supabase works correctly.
 */

import { test, expect } from './helpers/setup';
import { Page, Browser } from '@playwright/test';
import {
  loginAsInstructor,
  loginAsStudent,
  generateTestNamespaceId,
  createTestNamespace,
  cleanupNamespace,
} from './fixtures/auth-helpers';
import {
  createTestProblem,
  createTestClassViaAPI,
  createTestSectionViaAPI,
} from './fixtures/test-data';
import { createClient } from '@supabase/supabase-js';

// Supabase client for direct DB queries (validation)
function getSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseServiceKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY required for E2E tests');
  }

  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/**
 * Helper: Creates a session and returns session ID
 */
async function createSessionForTest(
  page: Page,
  testClass: any,
  testSection: any,
  testProblem: any
): Promise<string> {
  await page.goto('/instructor');
  await expect(page.locator('h2:has-text("Your Classes")')).toBeVisible({ timeout: 5000 });

  // Navigate to problems
  await page.click('button:has-text("Problems")');
  await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 5000 });

  // Create session
  const problemCard = page.locator(`div:has-text("${testProblem.title}")`).first();
  await expect(problemCard).toBeVisible({ timeout: 5000 });
  await problemCard.locator('button:has-text("Create Session")').first().click();

  await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });

  await page.selectOption('select#class', testClass.id);
  await page.waitForTimeout(500);
  await page.selectOption('select#section', testSection.id);
  await page.locator('button:has-text("Create Session")').last().click();

  // Wait for session to be created
  await expect(page.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 5000 });

  // Get session ID from API
  const sessionsData = await page.evaluate(async () => {
    const response = await fetch('/api/sessions', { credentials: 'include' });
    return response.json();
  });

  const activeSession = sessionsData.sessions.find(
    (s: any) => s.sectionId === testSection.id && s.status === 'active'
  );

  if (!activeSession) {
    throw new Error('Could not find active session');
  }

  return activeSession.id;
}

/**
 * Helper: Student joins section and session
 */
async function studentJoinSession(
  page: Page,
  joinCode: string
): Promise<void> {
  await page.goto('/sections');
  await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

  // Join section
  await page.click('button:has-text("Join Section"), button:has-text("Join Your First Section")');
  await expect(page.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });
  await page.fill('input#joinCode', joinCode);
  await page.click('button:has-text("Join Section")');

  // Wait for redirect
  await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

  // Join active session
  const joinNowButton = page.locator('button:has-text("Join Now")');
  await expect(joinNowButton).toBeVisible({ timeout: 5000 });
  await joinNowButton.click();

  // Wait for session to load
  await page.waitForURL(/\/student\?sessionId=/, { timeout: 5000 });
  await expect(page.locator('button:has-text("Leave Session")')).toBeVisible({ timeout: 5000 });
}

/**
 * Helper: Student types code using Monaco editor
 */
async function studentTypeCode(page: Page, code: string): Promise<void> {
  // Wait for Monaco editor
  const monacoEditor = page.locator('.monaco-editor').first();
  await expect(monacoEditor).toBeVisible({ timeout: 5000 });

  // Set code value
  await page.evaluate((codeValue) => {
    const model = (window as any).monaco.editor.getModels()[0];
    model.setValue(codeValue);
  }, code);

  // Run code to trigger WebSocket update
  await page.click('button:has-text("Run")');
  await page.waitForTimeout(1000); // Wait for execution and WebSocket sync
}

test.describe('WebSocket + Supabase Integration', () => {
  let namespaceId: string;
  let testClass: any;
  let testSection: any;
  let testProblem: any;
  let sessionId: string;
  let supabase: ReturnType<typeof getSupabaseClient>;

  test.beforeEach(async ({ page }) => {
    // Create unique namespace for test isolation
    namespaceId = generateTestNamespaceId();
    await createTestNamespace(namespaceId);

    // Setup instructor and test data
    await loginAsInstructor(page, `instructor-${namespaceId}`, namespaceId);

    testClass = await createTestClassViaAPI(page, 'CS 101', 'WebSocket Test Class');
    testSection = await createTestSectionViaAPI(page, testClass.id, 'Section A', 'Fall 2025');
    testProblem = await createTestProblem(
      page,
      'instructor-id',
      'Hello World',
      'Print Hello World',
      'print("Hello")'
    );

    sessionId = await createSessionForTest(page, testClass, testSection, testProblem);

    // Initialize Supabase client for validation queries
    supabase = getSupabaseClient();
  });

  test.afterEach(async () => {
    await cleanupNamespace(namespaceId);
  });

  test('Basic Persistence: Student code via WebSocket persists to Supabase', async ({ page, browser }) => {
    // Student joins session
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    await loginAsStudent(studentPage, `student-${namespaceId}`, namespaceId);
    await studentJoinSession(studentPage, testSection.joinCode);

    // Student types and runs code
    const testCode = 'print("Hello from WebSocket!")';
    await studentTypeCode(studentPage, testCode);

    // Wait for WebSocket + persistence
    await studentPage.waitForTimeout(2000);

    // VALIDATION: Query Supabase directly to confirm persistence
    const { data: revisions, error } = await supabase
      .from('revisions')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false })
      .limit(1);

    expect(error).toBeNull();
    expect(revisions).toBeTruthy();
    expect(revisions!.length).toBeGreaterThan(0);

    // Verify code content (handle both full_code and diff cases)
    const latestRevision = revisions![0];
    if (latestRevision.is_diff) {
      // If using diffs, just verify revision exists
      expect(latestRevision.diff).toBeTruthy();
    } else {
      // Full code should match
      expect(latestRevision.full_code).toContain('Hello from WebSocket');
    }

    await studentContext.close();
  });

  test('Concurrent Students: Multiple students persist correctly', async ({ page, browser }) => {
    // Create 3 concurrent students
    const studentContexts = await Promise.all([
      browser.newContext(),
      browser.newContext(),
      browser.newContext(),
    ]);

    const studentPages = await Promise.all(
      studentContexts.map((ctx) => ctx.newPage())
    );

    // All students log in and join session
    await Promise.all(
      studentPages.map(async (studentPage, index) => {
        await loginAsStudent(studentPage, `student-${index}-${namespaceId}`, namespaceId);
        await studentJoinSession(studentPage, testSection.joinCode);
      })
    );

    // All students type code simultaneously
    await Promise.all(
      studentPages.map(async (studentPage, index) => {
        const code = `print("Student ${index}")`;
        await studentTypeCode(studentPage, code);
      })
    );

    // Wait for all WebSocket messages to persist
    await page.waitForTimeout(3000);

    // VALIDATION: Query Supabase for all revisions
    const { data: revisions, error } = await supabase
      .from('revisions')
      .select('*')
      .eq('session_id', sessionId)
      .order('timestamp', { ascending: false });

    expect(error).toBeNull();
    expect(revisions).toBeTruthy();
    
    // Should have at least 3 revisions (one per student)
    expect(revisions!.length).toBeGreaterThanOrEqual(3);

    // Verify no data loss - check distinct students
    const distinctStudents = new Set(revisions!.map(r => r.student_id));
    expect(distinctStudents.size).toBeGreaterThanOrEqual(3);

    // Cleanup
    await Promise.all(studentContexts.map((ctx) => ctx.close()));
  });

  test('Disconnect/Reconnect: Revision history intact after reconnect', async ({ page, browser }) => {
    // Student joins session
    const studentContext = await browser.newContext();
    const studentPage = await studentContext.newPage();
    const studentUsername = `student-reconnect-${namespaceId}`;
    await loginAsStudent(studentPage, studentUsername, namespaceId);
    await studentJoinSession(studentPage, testSection.joinCode);

    // Student types first code
    await studentTypeCode(studentPage, 'print("Before disconnect")');
    await studentPage.waitForTimeout(2000);

    // Get student ID for later verification
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id')
      .eq('username', studentUsername)
      .single();

    const studentId = profiles?.id;
    expect(studentId).toBeTruthy();

    // SIMULATE DISCONNECT: Close browser context
    await studentContext.close();

    // Wait a moment
    await page.waitForTimeout(1000);

    // RECONNECT: Create new context and rejoin
    const newStudentContext = await browser.newContext();
    const newStudentPage = await newStudentContext.newPage();
    await loginAsStudent(newStudentPage, studentUsername, namespaceId);
    
    // Navigate directly to student page with sessionId
    await newStudentPage.goto(`/student?sessionId=${sessionId}`);
    await expect(newStudentPage.locator('button:has-text("Leave Session")')).toBeVisible({ timeout: 5000 });

    // Student types second code after reconnect
    await studentTypeCode(newStudentPage, 'print("After reconnect")');
    await newStudentPage.waitForTimeout(2000);

    // VALIDATION: Query revision history
    const { data: revisions, error } = await supabase
      .from('revisions')
      .select('*')
      .eq('session_id', sessionId)
      .eq('student_id', studentId)
      .order('timestamp', { ascending: true });

    expect(error).toBeNull();
    expect(revisions).toBeTruthy();
    
    // Should have at least 2 revisions (before and after disconnect)
    expect(revisions!.length).toBeGreaterThanOrEqual(2);

    // Verify chronological order maintained
    for (let i = 1; i < revisions!.length; i++) {
      const prevTimestamp = new Date(revisions![i - 1].timestamp).getTime();
      const currTimestamp = new Date(revisions![i].timestamp).getTime();
      expect(currTimestamp).toBeGreaterThanOrEqual(prevTimestamp);
    }

    await newStudentContext.close();
  });
});
