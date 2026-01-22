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
  cleanupNamespace
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

      // Wait for the instructor page to load - look for class-related content
      await expect(instructorPage.locator('h2:has-text("Your Classes"), h3:has-text("No Classes Yet"), button:has-text("Create Your First Class")').first()).toBeVisible({ timeout: 10000 });

      // Create class
      const createClassButton = instructorPage.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
      await createClassButton.click();
      await instructorPage.fill('input#class-name', 'Test Class');
      await instructorPage.click('button:has-text("Create Class")');
      await expect(instructorPage.locator('h3:has-text("Test Class")')).toBeVisible({ timeout: 5000 });

      // Click on class
      await instructorPage.locator('button:has-text("Test Class")').first().click();
      await expect(instructorPage.locator('h2:has-text("Test Class")')).toBeVisible({ timeout: 5000 });

      // Create section
      const createSectionButton = instructorPage.locator('button:has-text("New Section"), button:has-text("Create Section")').first();
      await createSectionButton.click();
      await instructorPage.fill('input#section-name', 'Test Section');
      await instructorPage.locator('button[type="submit"]:has-text("Create Section")').click();
      await expect(instructorPage.locator('h3:has-text("Test Section")')).toBeVisible({ timeout: 5000 });

      // Get join code from section card
      const sectionCard = instructorPage.locator('button:has-text("Test Section")').first();
      const cardText = await sectionCard.textContent() || '';
      // Match XXX-XXX (new format), XXX-XXX-XXX (old), or XXXXXX
      const joinCodeMatch = cardText.match(/[A-Z0-9]{3}-[A-Z0-9]{3}(?:-[A-Z0-9]{3})?|[A-Z0-9]{6}/);
      if (!joinCodeMatch) {
        throw new Error(`Could not find join code: "${cardText}"`);
      }
      const joinCode = joinCodeMatch[0];
      console.log('Section join code:', joinCode);

      // Click on section
      await instructorPage.locator('button:has-text("Test Section")').first().click();

      // Create session
      const newSessionButton = instructorPage.locator('button:has-text("New Session"), button:has-text("Create First Session")').first();
      await newSessionButton.click();
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

      // Instructor clicks "Student Code" tab to wait for students
      await instructorPage.locator('button:has-text("Student Code")').click();
      await expect(instructorPage.locator('h3:has-text("Connected Students")')).toBeVisible({ timeout: 5000 });

      console.log('Instructor viewing Student Code tab, waiting for students...');

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

      // First check if Realtime delivered the student
      const studentVisible = await instructorPage.locator(`text=${studentName}`).isVisible().catch(() => false);
      console.log('Student visible via Realtime:', studentVisible);

      if (!studentVisible) {
        // Realtime not working - this is the bug we're debugging
        console.log('REALTIME BUG: Student not visible.');

        // Wait a bit more to collect more logs
        await instructorPage.waitForTimeout(3000);

        // Print all Realtime-related logs
        console.log('All Realtime-related logs:');
        instructorLogs.filter(l => l.includes('Realtime')).forEach(l => console.log(l));

        // Fail with diagnostic info
        throw new Error(`Realtime subscription not delivering student updates. Student ${studentName} should appear but is not visible.`);
      }

      await expect(instructorPage.locator(`text=${studentName}`)).toBeVisible({ timeout: 5000 });

      console.log('Student appears in instructor view');

      // Click "Show on Public View" button for this student
      const studentRow = instructorPage.locator(`div:has-text("${studentName}")`).first();
      const showOnPublicViewBtn = studentRow.locator('button:has-text("Show on Public View")');
      await showOnPublicViewBtn.click();

      console.log('Clicked Show on Public View');

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
