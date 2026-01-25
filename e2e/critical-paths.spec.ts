import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials } from './helpers/db-helpers';
import {
  loginAsInstructor,
  loginAsStudent,
  generateTestNamespaceId,
  createTestNamespace,
  cleanupNamespace,
  navigateToDashboard,
} from './fixtures/auth-helpers';

/**
 * Critical Path E2E Tests
 *
 * This test covers the complete end-to-end user journey:
 * 1. Instructor creates class and section
 * 2. Instructor starts a coding session
 * 3. Student joins section via join code
 * 4. Student participates in session and runs code
 *
 * This is the most important test to maintain - it verifies the core
 * functionality that users depend on from start to finish.
 *
 * NOTE: These tests require Supabase to be running with proper credentials.
 * They will be skipped if SUPABASE_SECRET_KEY is not set.
 */

// Skip E2E tests if Supabase is not configured
const describeE2E = hasSupabaseCredentials() ? test.describe : test.describe.skip;

describeE2E('Critical User Paths', () => {
  test('Complete workflow: Instructor setup and student participation', async ({ page, browser }) => {
    // Create unique namespace for this test
    const namespaceId = generateTestNamespaceId();
    await createTestNamespace(namespaceId);

    try {
      // ===== INSTRUCTOR SETUP =====
      const instructorContext = await browser.newContext();
      const instructorPage = await instructorContext.newPage();
      await loginAsInstructor(instructorPage, `instructor-${namespaceId}`, namespaceId);
      await instructorPage.goto('/instructor');

      // Wait for the instructor dashboard to load
      // New dashboard shows "Dashboard" heading or empty state with "Create Your First Class"
      await expect(instructorPage.locator('h2:has-text("Dashboard"), button:has-text("Create Your First Class")').first()).toBeVisible({ timeout: 10000 });

      // Create class from dashboard
      const createClassButton = instructorPage.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
      await createClassButton.click();
      await expect(instructorPage.locator('h2:has-text("Create New Class")')).toBeVisible({ timeout: 5000 });
      await instructorPage.fill('input#class-name', 'Test Class');
      await instructorPage.click('button:has-text("Create Class")');

      // Wait for class to appear in dashboard table (as a table cell, not h3)
      await expect(instructorPage.locator('td:has-text("Test Class"), div:has-text("Test Class")').first()).toBeVisible({ timeout: 5000 });

      // Click the class name link to go to class details page where we can create sections
      await instructorPage.locator('a:has-text("Test Class")').first().click();

      // Wait for class details page to load
      await expect(instructorPage.locator('h1:has-text("Test Class")')).toBeVisible({ timeout: 5000 });

      // Create section from class details page
      const createSectionButton = instructorPage.locator('button:has-text("New Section"), button:has-text("Create First Section")').first();
      await createSectionButton.click();

      // Fill in section form (input has id="sectionName")
      await expect(instructorPage.locator('input#sectionName').first()).toBeVisible({ timeout: 5000 });
      await instructorPage.fill('input#sectionName', 'Test Section');
      await instructorPage.locator('button[type="submit"]:has-text("Create"), button:has-text("Create Section")').first().click();

      // Wait for section to appear - look for section card or table row
      await expect(instructorPage.locator('text=Test Section').first()).toBeVisible({ timeout: 5000 });

      // Navigate back to dashboard
      await navigateToDashboard(instructorPage);
      await expect(instructorPage.locator('h2:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });

      // Now the section should appear in the dashboard table with "Start Session" button
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

      // Wait for the Start Session modal
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

      // ===== STUDENT FLOW =====
      // Student joins the section using the join code
      await loginAsStudent(page, `student-${namespaceId}`, namespaceId);
      await page.goto('/sections');
      await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

      // Join section with join code
      const joinSectionButton = page.locator('button:has-text("Join Section"), button:has-text("Join Your First Section")').first();
      await joinSectionButton.click();
      // Wait for navigation to join page
      await expect(page).toHaveURL('/sections/join', { timeout: 5000 });
      await expect(page.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });
      console.log('Entering join code:', joinCode);
      await page.fill('input#joinCode', joinCode);
      await page.click('button[type="submit"]:has-text("Join Section")');

      // Wait for redirect back to sections page after successful join
      await expect(page).toHaveURL('/sections', { timeout: 5000 });
      await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 5000 });

      // Wait for the section card with active session to load
      // The "Join Now" button appears when session data is loaded
      const joinNowButton = page.locator('button:has-text("Join Now")');
      await expect(joinNowButton).toBeVisible({ timeout: 10000 });

      // Click "Join Now" to join the active session
      await joinNowButton.click();

      // Verify student entered session
      await expect(page.locator('h1:has-text("Live Coding Session")')).toBeVisible({ timeout: 10000 });

      // Verify connected status
      await expect(page.locator('text=Connected')).toBeVisible({ timeout: 5000 });

      // Verify the Run Code button is present (confirms editor loaded)
      await expect(page.locator('button:has-text("Run Code")')).toBeVisible({ timeout: 10000 });

      // Success! The complete flow works:
      // - Instructor created class + section from dashboard
      // - Instructor started session from dashboard modal
      // - Student joined section and entered the active session
      console.log('Critical path test completed successfully!');

      // Cleanup
      await instructorContext.close();
    } finally {
      // Clean up namespace after test
      await cleanupNamespace(namespaceId);
    }
  });

  test('Student code sync: code changes sync to instructor and public view', async ({ page, browser }) => {
    // Extend timeout for this complex multi-page test
    test.setTimeout(60000);
    /**
     * This test verifies the critical path of student code sync:
     * 1. Student modifies code in their editor
     * 2. Code is saved/synced to the server
     * 3. Instructor can view the student's code in real-time
     * 4. Code can be displayed on the public view
     */
    const namespaceId = generateTestNamespaceId();
    await createTestNamespace(namespaceId);

    let instructorContext: Awaited<ReturnType<typeof browser.newContext>> | undefined;
    let publicViewPage: Awaited<ReturnType<typeof browser.newPage>> | undefined;

    try {
      // ===== INSTRUCTOR SETUP =====
      instructorContext = await browser.newContext();
      const instructorPage = await instructorContext.newPage();
      await loginAsInstructor(instructorPage, `instructor-${namespaceId}`, namespaceId);
      await instructorPage.goto('/instructor');

      // Wait for dashboard to load
      await expect(instructorPage.locator('h2:has-text("Dashboard"), button:has-text("Create Your First Class")').first()).toBeVisible({ timeout: 10000 });

      // Create class
      const createClassButton = instructorPage.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
      await createClassButton.click();
      await instructorPage.fill('input#class-name', 'Sync Test Class');
      await instructorPage.click('button:has-text("Create Class")');
      await expect(instructorPage.locator('td:has-text("Sync Test Class"), div:has-text("Sync Test Class")').first()).toBeVisible({ timeout: 5000 });

      // Go to class and create section
      await instructorPage.locator('a:has-text("Sync Test Class")').first().click();
      await expect(instructorPage.locator('h1:has-text("Sync Test Class")')).toBeVisible({ timeout: 5000 });

      const createSectionButton = instructorPage.locator('button:has-text("New Section"), button:has-text("Create First Section")').first();
      await createSectionButton.click();
      await expect(instructorPage.locator('input#sectionName').first()).toBeVisible({ timeout: 5000 });
      await instructorPage.fill('input#sectionName', 'Sync Test Section');
      await instructorPage.locator('button[type="submit"]:has-text("Create"), button:has-text("Create Section")').first().click();
      await expect(instructorPage.locator('text=Sync Test Section').first()).toBeVisible({ timeout: 5000 });

      // Go back to dashboard and start session
      await navigateToDashboard(instructorPage);
      await expect(instructorPage.locator('h2:has-text("Dashboard")')).toBeVisible({ timeout: 5000 });

      // Get join code
      const joinCodeElement = instructorPage.locator('[data-testid="join-code"]').first();
      await expect(joinCodeElement).toBeVisible({ timeout: 5000 });
      const joinCode = await joinCodeElement.textContent();
      if (!joinCode) {
        throw new Error('Could not find join code');
      }
      console.log('Join code:', joinCode);

      // Start session
      await instructorPage.locator('button:has-text("Start Session")').first().click();
      await expect(instructorPage.locator('h2:has-text("Start Session")')).toBeVisible({ timeout: 5000 });
      await instructorPage.locator('button:has-text("Create blank session")').click();
      await expect(instructorPage.locator('button:has-text("Start Session"):not([disabled])').last()).toBeEnabled({ timeout: 5000 });
      await instructorPage.locator('button:has-text("Start Session"):not([disabled])').last().click();
      await expect(instructorPage).toHaveURL(/\/instructor\/session\//, { timeout: 10000 });
      await expect(instructorPage.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });

      console.log('Session started');

      // ===== OPEN PUBLIC VIEW =====
      // Open public view in a new tab
      [publicViewPage] = await Promise.all([
        instructorPage.context().waitForEvent('page'),
        instructorPage.locator('button:has-text("Open Public View")').click()
      ]);

      // Verify public view loads with initial state
      await expect(publicViewPage.locator('h1:has-text("Public Display")')).toBeVisible({ timeout: 10000 });
      await expect(publicViewPage.locator(`text=${joinCode}`)).toBeVisible({ timeout: 5000 });
      await expect(publicViewPage.locator('text=No submission selected for display')).toBeVisible({ timeout: 5000 });

      console.log('Public view opened');

      // ===== STUDENT JOINS AND WRITES CODE =====
      const studentName = `student-${namespaceId}`;
      await loginAsStudent(page, studentName, namespaceId);
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

      // Wait for initial empty code sync to complete (500ms debounce + buffer)
      // This prevents the initial empty code update from racing with our typed code
      await page.waitForTimeout(800);

      // ===== STUDENT TYPES CODE =====
      // Type distinctive code that we can verify later
      const studentCode = 'print("SYNC_TEST_12345")';
      const monacoEditor = page.locator('.monaco-editor').first();
      await monacoEditor.click();
      // Clear any existing code first (select all and delete)
      await page.keyboard.press('ControlOrMeta+a');
      await page.waitForTimeout(200); // Wait for selection to complete
      await page.keyboard.press('Backspace');
      await page.waitForTimeout(300); // Wait for Monaco to clear and stabilize
      // Type the new code slowly to ensure Monaco captures it
      // Use 50ms delay to give Monaco time to process each keystroke
      await page.keyboard.type(studentCode, { delay: 50 });

      console.log('Student typed code:', studentCode);

      // Wait for debounced sync (500ms debounce + network time)
      await page.waitForTimeout(2000);

      // Log the actual state after waiting
      const studentCodeInEditor = await page.evaluate(() => {
        const editor = document.querySelector('.monaco-editor');
        return editor?.textContent?.replace(/\s+/g, ' ').trim().substring(0, 100) || 'no editor found';
      });
      console.log('Student code after wait:', studentCodeInEditor);

      console.log('Waited for code sync');

      // ===== VERIFY INSTRUCTOR SEES STUDENT WITH CODE =====
      // Student should appear in the connected students list
      await expect(instructorPage.locator(`text=${studentName}`)).toBeVisible({ timeout: 10000 });

      // Log what instructor sees
      const instructorStudentList = await instructorPage.evaluate(() => {
        const students = document.querySelectorAll('div.border');
        return Array.from(students).map(s => s.textContent?.replace(/\s+/g, ' ').trim().substring(0, 100)).join(' | ');
      });
      console.log('Instructor student list:', instructorStudentList);

      // Wait for the "Has code" badge to appear - this confirms the code synced
      const studentRow = instructorPage.locator(`div.border:has-text("${studentName}")`).first();
      await expect(studentRow.locator('text=Has code')).toBeVisible({ timeout: 15000 });

      console.log('Student visible with code in instructor view');

      // ===== VERIFY INSTRUCTOR CAN VIEW STUDENT CODE =====
      // Click "View" button to see student's code
      const viewButton = studentRow.locator('button:has-text("View")').first();
      await viewButton.click();

      console.log('Clicked View button');

      // Wait for code editor to load with student's code
      // The code should appear in a read-only Monaco editor
      await expect(instructorPage.locator(`text=${studentName}'s Code`)).toBeVisible({ timeout: 5000 });

      // Verify the actual code content is visible in the editor
      // Monaco editor renders text in a specific way, so we check if the code text appears
      await expect(instructorPage.locator('.monaco-editor')).toBeVisible({ timeout: 5000 });

      // Verify the Monaco editor is displaying student code
      // Monaco splits text across elements, so check for partial matches
      const codeInEditor = await instructorPage.evaluate(() => {
        // Get all text content from Monaco editor area
        const editorArea = document.querySelector('.monaco-editor');
        if (!editorArea) return false;
        // Normalize text content by removing whitespace to handle syntax highlighting splits
        const text = editorArea.textContent?.replace(/\s/g, '') || '';
        return text.includes('SYNC_TEST') || text.includes('print');
      });

      expect(codeInEditor).toBe(true);

      console.log('Verified code content in instructor view');

      // ===== FEATURE STUDENT ON PUBLIC VIEW =====
      // Click "Feature" button to show student code on public view
      const featureButton = studentRow.locator('button:has-text("Feature")');
      await featureButton.click();

      console.log('Clicked Feature button');

      // ===== VERIFY PUBLIC VIEW SHOWS STUDENT CODE =====
      // The "No submission selected" message should disappear
      await expect(publicViewPage.locator('text=No submission selected for display')).not.toBeVisible({ timeout: 10000 });

      // Verify "Featured Code" section is displayed
      await expect(publicViewPage.locator('text=Featured Code')).toBeVisible({ timeout: 5000 });

      // Verify Monaco editor is visible in public view
      await expect(publicViewPage.locator('.monaco-editor')).toBeVisible({ timeout: 5000 });

      // Verify the student's code content is visible on public view
      const publicViewHasCode = await publicViewPage.evaluate(() => {
        const editorArea = document.querySelector('.monaco-editor');
        if (!editorArea) return false;
        const text = editorArea.textContent?.replace(/\s/g, '') || '';
        return text.includes('SYNC_TEST') || text.includes('print');
      });

      expect(publicViewHasCode).toBe(true);

      console.log('Verified code content in public view');
      console.log('Student code sync test completed successfully!');

    } finally {
      // Clean up
      try {
        await publicViewPage?.close();
      } catch { /* ignore */ }
      try {
        await instructorContext?.close();
      } catch { /* ignore */ }
      await cleanupNamespace(namespaceId);
    }
  });
});
