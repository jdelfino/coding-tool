import { test, expect } from './helpers/setup';
import { loginAsInstructor, loginAsStudent } from './fixtures/auth-helpers';

/**
 * Critical Path E2E Tests
 *
 * This test covers the complete end-to-end user journey:
 * 1. Instructor creates class, section, and problem
 * 2. Instructor starts a coding session
 * 3. Student joins section via join code
 * 4. Student participates in session and submits code
 *
 * This is the most important test to maintain - it verifies the core
 * functionality that users depend on from start to finish.
 */

test.describe('Critical User Paths', () => {
  test('Complete workflow: Instructor setup and student participation', async ({ page, browser }) => {
    // First, instructor creates a session
    const instructorContext = await browser.newContext();
    const instructorPage = await instructorContext.newPage();
    await loginAsInstructor(instructorPage, 'instructor-for-student');
    await instructorPage.goto('/instructor');

    // Create class
    const createButton = instructorPage.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
    await createButton.click();
    await instructorPage.fill('input#class-name', 'Student Test Class');
    await instructorPage.click('button:has-text("Create Class")');
    await expect(instructorPage.locator('text=Student Test Class')).toBeVisible();

    // Create section and capture join code
    await instructorPage.click('button:has-text("Student Test Class")');
    await instructorPage.click('button:has-text("Create Section"), button:has-text("Create Your First Section")');
    await instructorPage.fill('input#section-name', 'Student Test Section');
    await instructorPage.locator('form button:has-text("Create Section")').click();
    await expect(instructorPage.locator('text=Student Test Section')).toBeVisible();

    // Get join code from section card (6-character alphanumeric code)
    const joinCodeElement = instructorPage.locator('text=/[A-Z0-9]{6}/').first();
    await expect(joinCodeElement).toBeVisible({ timeout: 5000 });
    const joinCode = (await joinCodeElement.textContent()) || '';
    console.log('Section join code:', joinCode);

    // Create problem
    await instructorPage.click('button:has-text("Problems")');
    await expect(instructorPage.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 5000 });
    await instructorPage.click('button:has-text("Create New Problem")');
    await instructorPage.fill('input#problem-title', 'Hello World');
    await instructorPage.fill('textarea#problem-description', 'Print Hello World');
    await instructorPage.locator('button:has-text("Create Problem")').first().click();
    await expect(instructorPage.locator('text=Hello World')).toBeVisible();

    // Create session
    const problemCard = instructorPage.locator('div:has-text("Hello World")').first();
    await problemCard.locator('button:has-text("Create Session")').click();
    await instructorPage.selectOption('select#class', { label: 'Student Test Class' });
    await instructorPage.waitForTimeout(500);
    await instructorPage.selectOption('select#section', { label: 'Student Test Section' });
    await instructorPage.locator('button:has-text("Create Session")').last().click();

    // Wait for session view to load
    await expect(instructorPage.locator('h2:has-text("Active Session")')).toBeVisible({ timeout: 10000 });

    // Now student joins the section using the join code
    await loginAsStudent(page, 'test-student-critical');
    await page.goto('/sections');
    await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 10000 });

    // Join section with join code
    await page.click('button:has-text("Join Section"), button:has-text("Join Your First Section")');
    await expect(page.locator('h2:has-text("Join a Section")')).toBeVisible({ timeout: 5000 });
    await page.fill('input#joinCode', joinCode);
    await page.click('button:has-text("Join Section")');

    // Wait for redirect back to sections page after successful join
    await expect(page.locator('h1:has-text("My Sections")')).toBeVisible({ timeout: 10000 });

    // The active session should be visible in the section - look for the "Join Now" button
    await expect(page.locator('button:has-text("Join Now")')).toBeVisible({ timeout: 5000 });

    // Click "Join Now" to join the active session
    await page.click('button:has-text("Join Now")');

    // Verify student entered session
    await expect(page.locator('h1:has-text("Live Coding Session")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('h2:has-text("Hello World")')).toBeVisible({ timeout: 5000 });

    // Write and submit code
    const monacoEditor = page.locator('.monaco-editor').first();
    await expect(monacoEditor).toBeVisible({ timeout: 5000 });
    await page.evaluate(() => {
      const model = (window as any).monaco.editor.getModels()[0];
      model.setValue('print("Hello World")');
    });
    await page.click('button:has-text("Run")');

    // Verify execution output
    await expect(page.locator('pre:has-text("Hello World")')).toBeVisible({ timeout: 10000 });

    // Cleanup
    await instructorContext.close();
  });
});
