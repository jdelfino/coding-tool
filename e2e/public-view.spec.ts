/**
 * E2E tests for the Public View feature
 *
 * Tests the public display view that instructors show during class.
 * Based on the critical-paths test flow.
 *
 * NOTE: These tests require Supabase to be running with proper credentials.
 * They will be skipped if SUPABASE_SECRET_KEY is not set.
 */

import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials } from './helpers/db-helpers';
import {
  loginAsInstructor,
  loginAsStudent,
  generateTestNamespaceId,
  createTestNamespace,
  cleanupNamespace,
  navigateToDashboard
} from './fixtures/auth-helpers';

// Skip E2E tests if Supabase is not configured
const describeE2E = hasSupabaseCredentials() ? test.describe : test.describe.skip;

describeE2E('Public View Feature', () => {
  test('Public view updates when instructor features different students', async ({ page, browser }) => {
    const namespaceId = generateTestNamespaceId();
    await createTestNamespace(namespaceId);

    // Declare contexts/pages outside try block so they're accessible in finally
    let instructorContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    let publicViewPage: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      // ===== INSTRUCTOR SETUP =====
      instructorContext = await browser.newContext();
      const instructorPage = await instructorContext.newPage();
      await loginAsInstructor(instructorPage, `instructor-${namespaceId}`, namespaceId);
      await instructorPage.goto('/instructor');

      // Wait for the instructor dashboard to load
      await expect(instructorPage.locator('h2:has-text("Dashboard"), button:has-text("Create Your First Class")').first()).toBeVisible({ timeout: 10000 });

      // Create class from dashboard
      const createClassButton = instructorPage.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
      await createClassButton.click();
      await instructorPage.fill('input#class-name', 'Test Class');
      await instructorPage.click('button:has-text("Create Class")');

      // Wait for class to appear in dashboard table
      await expect(instructorPage.locator('td:has-text("Test Class"), div:has-text("Test Class")').first()).toBeVisible({ timeout: 5000 });

      // Click the class name link to go to class details page where we can create sections
      await instructorPage.locator('a:has-text("Test Class")').first().click();
      await expect(instructorPage.locator('h1:has-text("Test Class")')).toBeVisible({ timeout: 5000 });

      // Create section from class details page
      const createSectionButton = instructorPage.locator('button:has-text("New Section"), button:has-text("Create First Section")').first();
      await createSectionButton.click();
      // Fill in section form (input has id="sectionName")
      await expect(instructorPage.locator('input#sectionName').first()).toBeVisible({ timeout: 5000 });
      await instructorPage.fill('input#sectionName', 'Test Section');
      await instructorPage.locator('button[type="submit"]:has-text("Create"), button:has-text("Create Section")').first().click();
      await expect(instructorPage.locator('text=Test Section').first()).toBeVisible({ timeout: 5000 });

      // Navigate back to dashboard
      await navigateToDashboard(instructorPage);
      await expect(instructorPage.locator('h2:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });
      await expect(instructorPage.locator('text=Test Section')).toBeVisible({ timeout: 5000 });

      // Get join code from dashboard table using data-testid
      const joinCodeElement = instructorPage.locator('[data-testid="join-code"]').first();
      await expect(joinCodeElement).toBeVisible({ timeout: 5000 });
      const joinCode = await joinCodeElement.textContent();
      if (!joinCode) {
        throw new Error('Could not find join code on dashboard page');
      }
      console.log('Section join code:', joinCode);

      // Click "Start Session" to open the modal
      await instructorPage.locator('button:has-text("Start Session")').first().click();
      await expect(instructorPage.locator('h2:has-text("Start Session")')).toBeVisible({ timeout: 5000 });

      // Click "Create blank session" option to enable the Start Session button
      await instructorPage.locator('button:has-text("Create blank session")').click();

      // Wait for Start Session button to be enabled, then click it
      await expect(instructorPage.locator('button:has-text("Start Session"):not([disabled])').last()).toBeEnabled({ timeout: 5000 });
      await instructorPage.locator('button:has-text("Start Session"):not([disabled])').last().click();

      // Wait for navigation to session page
      await expect(instructorPage).toHaveURL(/\/instructor\/session\//, { timeout: 10000 });

      // Verify session view loaded (check for h2 heading "Active Session")
      await expect(instructorPage.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });

      // Capture console logs from instructor page
      const instructorLogs: string[] = [];
      instructorPage.on('console', msg => {
        const text = `${msg.type()}: ${msg.text()}`;
        instructorLogs.push(text);
        if (msg.text().includes('Realtime')) {
          console.log(`[InstructorPage] ${text}`);
        }
      });

      // ===== OPEN PUBLIC VIEW =====
      [publicViewPage] = await Promise.all([
        instructorPage.context().waitForEvent('page'),
        instructorPage.locator('button:has-text("Open Public View")').click()
      ]);

      // Capture public view logs IMMEDIATELY after page opens (before it loads)
      publicViewPage.on('console', msg => {
        if (msg.text().includes('Realtime') || msg.text().includes('PublicView')) {
          console.log(`[PublicView] ${msg.type()}: ${msg.text()}`);
        }
      });

      // Verify public view loaded
      await expect(publicViewPage.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 10000 });
      await expect(publicViewPage.locator(`text=${joinCode}`)).toBeVisible({ timeout: 5000 });
      await expect(publicViewPage.locator('text=No submission selected for display')).toBeVisible({ timeout: 5000 });

      console.log('Public view opened, shows no submission');

      // Verify student list panel is visible (always visible in new layout, no tabs)
      await expect(instructorPage.locator('h3:has-text("Connected Students")')).toBeVisible({ timeout: 5000 });

      console.log('Instructor viewing student list, waiting for students...');

      // ===== STUDENT JOINS AND WRITES CODE =====
      await loginAsStudent(page, `student-${namespaceId}`, namespaceId);
      await page.goto('/sections');
      await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

      // Join section
      const joinSectionButton = page.locator('button:has-text("Join Section"), button:has-text("Join Your First Section")').first();
      await joinSectionButton.click();
      await expect(page).toHaveURL('/sections/join', { timeout: 5000 });
      await page.fill('input#joinCode', joinCode);
      await page.click('button[type="submit"]:has-text("Join Section")');
      await expect(page).toHaveURL('/sections', { timeout: 5000 });

      // Join active session
      const joinNowButton = page.locator('button:has-text("Join Now")');
      await expect(joinNowButton).toBeVisible({ timeout: 10000 });
      await joinNowButton.click();
      await expect(page.locator('h1:has-text("Live Coding Session")')).toBeVisible({ timeout: 10000 });
      await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 });

      console.log('Student joined session');

      // Student types code in the Monaco editor
      const studentCode = 'print("Hello from student!")';
      const monacoEditor = page.locator('.monaco-editor').first();
      await monacoEditor.click();
      await page.keyboard.type(studentCode);

      console.log('Student typed code');

      // Wait for debounced code update (500ms debounce + network time)
      await page.waitForTimeout(2000);

      console.log('Waited for code to sync');

      // ===== VERIFY INSTRUCTOR SEES STUDENT =====
      const studentName = `student-${namespaceId}`;
      console.log('Looking for student:', studentName);

      // Wait for student to appear - either via Realtime broadcast or polling fallback
      // Polling runs every 2 seconds, so give it enough time (10 seconds)
      await expect(instructorPage.locator(`text=${studentName}`)).toBeVisible({ timeout: 10000 });

      console.log('Student appears in instructor view');

      // Click "Feature" button for this student (shows their code on public view)
      const studentRow = instructorPage.locator(`div:has-text("${studentName}")`).first();
      const featureBtn = studentRow.locator('button:has-text("Feature")');
      await featureBtn.click();

      console.log('Clicked Feature button');

      // ===== VERIFY PUBLIC VIEW UPDATES =====
      // The public view should now show the student's code
      // Wait for the "No submission selected" message to disappear
      await expect(publicViewPage.locator('text=No submission selected for display')).not.toBeVisible({ timeout: 10000 });

      // Verify the featured code section is displayed (CodeEditor with title)
      await expect(publicViewPage.locator('text=Featured Code')).toBeVisible({ timeout: 5000 });

      // Verify there's a Monaco editor visible with some code
      await expect(publicViewPage.locator('.monaco-editor')).toBeVisible({ timeout: 5000 });

      console.log('Public view updated with featured code!');
    } finally {
      // Close pages first to stop polling before cleaning up database
      try {
        // These may throw if pages are already closed
        await publicViewPage?.close();
      } catch { /* ignore */ }
      try {
        await instructorContext?.close();
      } catch { /* ignore */ }
      await cleanupNamespace(namespaceId);
    }
  });
});
