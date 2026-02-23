import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials } from './helpers/db-helpers';
import {
  loginAsInstructor,
  loginAsStudent,
  generateTestNamespaceId,
  cleanupNamespace,
} from './fixtures/auth-helpers';
import {
  getSupabaseAdmin,
  setupTestNamespaceWithSection,
  createInstructorForSection,
  createTestProblem,
} from './helpers/test-data';

/**
 * Session Lifecycle E2E Tests
 *
 * Tests the instructor's real day-to-day workflow:
 * 1. Starting sessions from problem pages
 * 2. Session replacement when switching problems
 * 3. Student practice execution in ended sessions
 *
 * This covers code paths not exercised by critical-paths tests:
 * - Starting sessions from /problems/[id] (InstructorActions component)
 * - Auto-session-replacement via session_replaced broadcast
 * - Student transitioning between replacement sessions
 * - Practice execution in completed sessions
 */

// Skip E2E tests if Supabase is not configured
const describeE2E = hasSupabaseCredentials() ? test.describe : test.describe.skip;

describeE2E('Session Lifecycle', () => {
  test('Complete workflow: problem-based session start, replacement, and practice mode', async ({ page, browser }) => {
    // Extend timeout for this complex multi-page test
    test.setTimeout(90000);

    const namespaceId = generateTestNamespaceId();
    const supabase = getSupabaseAdmin();

    let instructorContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;

    try {
      // ===== SETUP (DB bootstrapping, not UI) =====
      const { class: testClass, section, adminUserId } = await setupTestNamespaceWithSection(supabase, namespaceId);
      const instructor = await createInstructorForSection(supabase, section.id, namespaceId, `instructor-${Date.now()}`);

      // Create two test problems
      const problemA = await createTestProblem(supabase, {
        classId: testClass.id,
        namespaceId,
        authorId: adminUserId,
        title: 'FizzBuzz',
        starterCode: '# FizzBuzz starter\n',
        description: 'Implement FizzBuzz',
      });

      const problemB = await createTestProblem(supabase, {
        classId: testClass.id,
        namespaceId,
        authorId: adminUserId,
        title: 'Fibonacci',
        starterCode: '# Fibonacci starter\n',
        description: 'Implement Fibonacci',
      });

      console.log('Test setup complete:', {
        namespaceId,
        classId: testClass.id,
        sectionId: section.id,
        joinCode: section.joinCode,
        problemA: problemA.id,
        problemB: problemB.id,
      });

      // ===== INSTRUCTOR LOGIN =====
      instructorContext = await browser.newContext();
      const instructorPage = await instructorContext.newPage();

      // Login instructor using existing auth helpers
      await instructorPage.goto('/auth/signin');
      await instructorPage.fill('input[name="email"]', instructor.email);
      await instructorPage.fill('input[name="password"]', 'testpassword123');
      await instructorPage.click('button[type="submit"]');
      await instructorPage.waitForURL(/^(?!.*\/auth\/signin).*$/, { timeout: 10000 });

      console.log('Instructor logged in');

      // ===== STUDENT LOGIN =====
      const studentName = `student-${namespaceId}`;
      await loginAsStudent(page, studentName, namespaceId);
      await page.goto('/sections');
      await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

      // Student joins section
      await page.locator('button:has-text("Join Section"), button:has-text("Join Your First Section")').first().click();
      await expect(page).toHaveURL('/sections/join', { timeout: 5000 });
      await page.fill('input#joinCode', section.joinCode);
      await page.click('button[type="submit"]:has-text("Join Section")');
      await expect(page).toHaveURL('/sections', { timeout: 15000 });

      console.log('Student joined section');

      // ===== STEP 1: Instructor starts session from Problem A's page =====
      await instructorPage.goto(`/problems/${problemA.id}`);
      await expect(instructorPage.locator(`h1:has-text("${problemA.title}")`)).toBeVisible({ timeout: 10000 });

      // Click "Start Session" button
      await instructorPage.locator('button:has-text("Start Session")').click();

      // Wait for redirect to public view (auto-creates session since only one section)
      await expect(instructorPage).toHaveURL(/\/public-view\?sessionId=/, { timeout: 15000 });

      // Extract first session ID from URL
      const firstSessionUrl = instructorPage.url();
      const firstSessionId = new URL(firstSessionUrl).searchParams.get('sessionId');
      console.log('First session created:', firstSessionId);

      // Verify public view loaded with join code
      await expect(instructorPage.locator(`text=${section.joinCode.slice(0, 3)}`)).toBeVisible({ timeout: 10000 });

      // ===== STEP 2: Student joins session =====
      // Go back to sections page
      await page.goto('/sections');
      await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

      // Click "Join Now" to join the active session
      const joinNowButton = page.locator('button:has-text("Join Now")');
      await expect(joinNowButton).toBeVisible({ timeout: 10000 });
      await joinNowButton.click();

      // Verify student entered session
      await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 });

      console.log('Student joined first session');

      // ===== STEP 3: Student types code =====
      const studentCode1 = 'print("FIZZBUZZ_TEST_12345")';
      const monacoEditor = page.locator('.monaco-editor').first();
      await monacoEditor.click();
      await page.keyboard.press('ControlOrMeta+a');
      await expect(async () => {
        // Wait for select-all to register
        const text = await page.evaluate(() => window.getSelection()?.toString() || '');
        expect(text.length).toBeGreaterThan(0);
      }).toPass({ timeout: 2000 }).catch(() => {
        // Selection may be empty for empty editor, that's OK
      });
      await page.keyboard.press('Backspace');
      await page.keyboard.type(studentCode1, { delay: 30 });

      // Wait for debounced sync - poll instructor view for code to appear
      const instructorSessionUrl = `/instructor/session/${firstSessionId}`;
      await instructorPage.goto(instructorSessionUrl);
      await expect(instructorPage.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });

      // Wait for student to appear with "In progress" badge
      const studentRow = instructorPage.locator(`div.border:has-text("${studentName}")`).first();
      await expect(studentRow).toBeVisible({ timeout: 15000 });
      await expect(studentRow.locator('text=In progress')).toBeVisible({ timeout: 15000 });

      console.log('Student code synced to first session');

      // ===== STEP 4: Instructor starts session from Problem B's page (replaces session 1) =====
      await instructorPage.goto(`/problems/${problemB.id}`);
      await expect(instructorPage.locator(`h1:has-text("${problemB.title}")`)).toBeVisible({ timeout: 10000 });

      // Click "Start Session" button
      await instructorPage.locator('button:has-text("Start Session")').click();

      // Wait for redirect to public view with NEW session ID
      await expect(instructorPage).toHaveURL(/\/public-view\?sessionId=/, { timeout: 15000 });

      const secondSessionUrl = instructorPage.url();
      const secondSessionId = new URL(secondSessionUrl).searchParams.get('sessionId');
      console.log('Second session created:', secondSessionId);

      // Verify this is a different session
      expect(secondSessionId).not.toBe(firstSessionId);

      // ===== STEP 5: Student sees replacement notification =====
      await expect(page.locator('text=The instructor started a new problem.')).toBeVisible({ timeout: 15000 });
      await expect(page.locator('[data-testid="join-new-session-button"]')).toBeVisible({ timeout: 5000 });

      console.log('Student sees replacement notification');

      // ===== STEP 6: Student joins replacement session =====
      await page.locator('[data-testid="join-new-session-button"]').click();

      // Wait for navigation to new session URL
      await expect(page).toHaveURL(new RegExp(`sessionId=${secondSessionId}`), { timeout: 10000 });

      // Verify student is in the new session (no replacement banner)
      await expect(page.locator('.monaco-editor')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 });
      // Replacement banner should be gone now
      await expect(page.locator('[data-testid="join-new-session-button"]')).not.toBeVisible({ timeout: 5000 });

      console.log('Student joined replacement session');

      // DIAGNOSTIC: Check what code is actually in the editor after join
      const codeAfterJoin = await page.evaluate(() => {
        const monacoEditors = (window as any).monaco?.editor?.getModels();
        if (monacoEditors && monacoEditors.length > 0) {
          return monacoEditors[0].getValue();
        }
        return 'NO_MONACO_MODEL';
      });
      console.log('[TEST] Code in editor after join (Monaco API):', JSON.stringify(codeAfterJoin.substring(0, 50)));

      // Also check DOM content
      const domContent = await page.getByRole('code').first().textContent();
      console.log('[TEST] Code in editor after join (DOM):', JSON.stringify(domContent?.substring(0, 80)));

      // ===== STEP 7: Student types code in session 2, instructor verifies =====
      // Wait for the replacement banner to be gone (confirms clean session state)
      await expect(page.locator('[data-testid="session-ended-notification"]')).not.toBeVisible({ timeout: 3000 });

      // CRITICAL: Wait for Monaco editor to be fully ready with Fibonacci starter code
      // Use toContainText() on [role="code"] which auto-retries - the most reliable readiness signal
      const editor = page.getByRole('code').first();
      await expect(editor).toBeVisible({ timeout: 10000 });
      await expect(editor).toContainText('Fibonacci starter', { timeout: 10000 });

      // Focus the editor and wait for focus to register
      await editor.click();
      await page.waitForSelector('.monaco-editor.focused', { timeout: 5000 });

      // Now that content is stable, type the new code
      const studentCode2 = 'print("FIBONACCI_TEST_67890")';
      await page.keyboard.press('ControlOrMeta+a');
      await page.keyboard.press('Backspace');
      await page.keyboard.type(studentCode2, { delay: 50 });

      console.log('Student typed code in second session');

      // Navigate instructor to session page and verify student connection
      await instructorPage.goto(`/instructor/session/${secondSessionId}`);
      await expect(instructorPage.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });

      // Wait for student to appear - should happen within a few seconds after join + code sync
      const studentRow2 = instructorPage.locator(`div.border:has-text("${studentName}")`).first();
      await expect(studentRow2).toBeVisible({ timeout: 15000 });
      await expect(studentRow2.locator('text=In progress')).toBeVisible({ timeout: 5000 });

      console.log('Student code synced to second session - instructor verified');

      // ===== STEP 8: Instructor ends session =====
      await instructorPage.locator('button:has-text("End Session")').click();

      // Confirm in dialog (use more specific selector for the confirm dialog, not the nav menu)
      const confirmDialog = instructorPage.locator('[role="dialog"][aria-labelledby="confirm-dialog-title"]');
      await expect(confirmDialog).toBeVisible({ timeout: 5000 });
      await confirmDialog.locator('button[data-confirm-button]').click();

      // Verify instructor redirected to dashboard
      await expect(instructorPage).toHaveURL(/\/instructor/, { timeout: 10000 });

      console.log('Session ended by instructor');

      // ===== STEP 9: Student sees session ended notification =====
      await expect(page.locator('[data-testid="session-ended-notification"]')).toBeVisible({ timeout: 15000 });

      // Verify NO "Join New Session" button (session was ended, not replaced)
      await expect(page.locator('[data-testid="join-new-session-button"]')).not.toBeVisible({ timeout: 3000 });

      console.log('Student sees session ended notification (not replacement)');

      // ===== STEP 10: Student runs code in ended session (practice mode) =====
      // Verify "Run Code" button is visible in ended session
      await expect(page.locator('button:has-text("Run Code")')).toBeVisible({ timeout: 5000 });

      // Click "Run Code"
      await page.locator('button:has-text("Run Code")').click();

      // Verify output panel shows execution result
      // Practice mode execution should complete within 10 seconds
      await expect(page.locator('text=FIBONACCI_TEST_67890')).toBeVisible({ timeout: 10000 });

      console.log('Practice mode execution successful!');
      console.log('Session lifecycle test completed successfully!');

    } finally {
      try {
        await instructorContext?.close();
      } catch { /* ignore */ }
      await cleanupNamespace(namespaceId);
    }
  });
});
