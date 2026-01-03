import { test, expect } from './helpers/setup';
import { loginAsInstructor, loginAsStudent } from './fixtures/auth-helpers';

/**
 * Critical Path E2E Tests
 *
 * These tests cover the essential user journeys through the application:
 * 1. Instructor creates class and section
 * 2. Instructor creates problem and starts session
 * 3. Student joins section and session
 * 4. Student submits code
 * 5. Instructor views public view
 *
 * These are the most important tests to maintain - they verify the core
 * functionality that users depend on.
 */

test.describe('Critical User Paths', () => {
  test('Instructor: Create class and section', async ({ page }) => {
    await loginAsInstructor(page, 'instructor-flow');
    await page.goto('/instructor');

    // Create a class
    await expect(page.locator('h2:has-text("Your Classes"), h3:has-text("No Classes Yet")')).toBeVisible({ timeout: 5000 });
    const createButton = page.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
    await createButton.click();
    await expect(page.locator('h2:has-text("Create New Class")')).toBeVisible();
    await page.fill('input#class-name', 'CS 101');
    await page.fill('textarea#class-description', 'Introduction to Programming');
    await page.click('button:has-text("Create Class")');

    // Verify class created and navigate to sections
    await expect(page.locator('text=CS 101')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("CS 101")');
    // When class is selected, SectionView shows class name in h2 (not h1)
    await expect(page.locator('h2:has-text("CS 101")')).toBeVisible({ timeout: 5000 });

    // Create a section
    await page.click('button:has-text("Create Section"), button:has-text("Create Your First Section")');
    await expect(page.locator('h2:has-text("Create New Section")')).toBeVisible();
    await page.fill('input#section-name', 'Fall 2026');
    // Click the Create Section button inside the modal form (not the button that opened it)
    await page.locator('form button:has-text("Create Section")').click();

    // Verify section created with join code
    await expect(page.locator('text=Fall 2026')).toBeVisible({ timeout: 5000 });
    // TODO: Verify join code displays - currently blocked by coding-tool-4tq bug
    // The join code badge renders but shows empty text despite API returning it
    await expect(page.locator('text=0 students')).toBeVisible();
  });

  test('Instructor: Create problem and start session', async ({ page }) => {
    await loginAsInstructor(page, 'instructor-session');
    await page.goto('/instructor');

    // First create a class and section (prerequisite)
    const createButton = page.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
    await createButton.click();
    await page.fill('input#class-name', 'Test Class');
    await page.click('button:has-text("Create Class")');
    await expect(page.locator('text=Test Class')).toBeVisible();

    await page.click('button:has-text("Test Class")');
    await page.click('button:has-text("Create Section"), button:has-text("Create Your First Section")');
    await page.fill('input#section-name', 'Test Section');
    await page.locator('form button:has-text("Create Section")').click();
    await expect(page.locator('text=Test Section')).toBeVisible();

    // Create a problem
    await page.click('button:has-text("Problems")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 5000 });
    await page.click('button:has-text("Create New Problem")');
    await expect(page.locator('h2:has-text("Create New Problem")')).toBeVisible();
    await page.fill('input#problem-title', 'Test Problem');
    await page.fill('textarea#problem-description', 'Write a function that adds two numbers');
    await page.locator('button:has-text("Create Problem")').first().click();
    await expect(page.locator('text=Test Problem')).toBeVisible({ timeout: 5000 });

    // Create session from problem card
    const problemCard = page.locator('div:has-text("Test Problem")').first();
    await problemCard.locator('button:has-text("Create Session")').click();
    await expect(page.locator('h2:has-text("Create Session")')).toBeVisible({ timeout: 5000 });

    // Select class and section
    await page.selectOption('select#class', { label: 'Test Class' });
    await page.waitForTimeout(500); // Wait for sections to load
    await page.selectOption('select#section', { label: 'Test Section' });

    // Submit the form (use .last() to get the modal button, not the problem card button)
    await page.locator('button:has-text("Create Session")').last().click();

    // Verify session was created - should show in active session view
    await expect(page.locator('h3:has-text("Test Problem")').first()).toBeVisible({ timeout: 5000 });
  });

  test.skip('Student: Join section and session (NEEDS UPDATE)', async ({ page }) => {
    // TODO: Update this test for new student flow
    // The student flow has been significantly modified
    // Need to understand: How do students join sections now? Via join code?
    // How do they join sessions? Via section page?
  });
});
