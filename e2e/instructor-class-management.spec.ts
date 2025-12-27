import { test, expect } from './helpers/setup';
import { loginAsInstructor } from './fixtures/auth-helpers';
import { createTestClass } from './fixtures/test-data';

/**
 * E2E tests for instructor class management workflows
 * Tests: create, edit, delete classes
 * 
 * These tests verify the CRUD operations for classes and catch
 * modal rendering/closing bugs that occurred in earlier versions.
 */

test.describe('Instructor Class Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as instructor before each test
    await loginAsInstructor(page, 'test-instructor');
    
    // Navigate to instructor dashboard
    await page.goto('/instructor');
    
    // Wait for the page to load
    await expect(page.locator('h2:has-text("Your Classes"), h3:has-text("No Classes Yet")')).toBeVisible({ timeout: 10000 });
  });

  test('should display empty state when no classes exist', async ({ page }) => {
    // Verify empty state message appears
    await expect(page.locator('h3:has-text("No Classes Yet")')).toBeVisible();
    await expect(page.locator('text=Create your first class to get started')).toBeVisible();
    
    // Verify "Create Your First Class" button exists
    await expect(page.locator('button:has-text("Create Your First Class")')).toBeVisible();
  });

  test('should create a new class successfully', async ({ page }) => {
    // Click "New Class" or "Create Your First Class" button
    const createButton = page.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
    await createButton.click();
    
    // Verify modal appears (regression test for modal rendering bug)
    await expect(page.locator('h2:has-text("Create New Class")')).toBeVisible();
    
    // Fill in class name
    await page.fill('input#class-name', 'CS 101');
    
    // Fill in description
    await page.fill('textarea#class-description', 'Introduction to Computer Science');
    
    // Submit the form
    await page.click('button:has-text("Create Class")');
    
    // Wait for modal to close (regression test for modal closing bug)
    await expect(page.locator('h2:has-text("Create New Class")')).not.toBeVisible({ timeout: 5000 });
    
    // Verify class appears in the list (regression test for UI update bug)
    await expect(page.locator('text=CS 101')).toBeVisible();
    await expect(page.locator('text=Introduction to Computer Science')).toBeVisible();
    
    // Verify persistence - reload page and check class still exists
    await page.reload();
    await expect(page.locator('text=CS 101')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Introduction to Computer Science')).toBeVisible();
  });

  test('should create a class with name only (no description)', async ({ page }) => {
    // Click create button
    const createButton = page.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
    await createButton.click();
    
    // Wait for modal
    await expect(page.locator('h2:has-text("Create New Class")')).toBeVisible();
    
    // Fill in only class name
    await page.fill('input#class-name', 'CS 202');
    
    // Submit without description
    await page.click('button:has-text("Create Class")');
    
    // Verify modal closes
    await expect(page.locator('h2:has-text("Create New Class")')).not.toBeVisible({ timeout: 5000 });
    
    // Verify class appears
    await expect(page.locator('text=CS 202')).toBeVisible();
  });

  test('should show validation error for empty class name', async ({ page }) => {
    // Click create button
    const createButton = page.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
    await createButton.click();
    
    // Wait for modal
    await expect(page.locator('h2:has-text("Create New Class")')).toBeVisible();
    
    // Verify submit button is disabled when form is empty
    const submitButton = page.locator('button:has-text("Create Class")');
    await expect(submitButton).toBeDisabled();
    
    // Verify modal stays open
    await expect(page.locator('h2:has-text("Create New Class")')).toBeVisible();
    
    // Fill in required field
    await page.fill('input#class-name', 'CS 303');
    
    // Verify submit button is now enabled
    await expect(submitButton).toBeEnabled();
    
    // Submit form
    await submitButton.click();
    
    // Verify submission succeeds and modal closes
    await expect(page.locator('h2:has-text("Create New Class")')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=CS 303')).toBeVisible();
  });

  test('should cancel class creation', async ({ page }) => {
    // Click create button
    const createButton = page.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
    await createButton.click();
    
    // Wait for modal
    await expect(page.locator('h2:has-text("Create New Class")')).toBeVisible();
    
    // Fill in some data
    await page.fill('input#class-name', 'Test Class');
    
    // Click cancel
    await page.click('button:has-text("Cancel")');
    
    // Verify modal closes
    await expect(page.locator('h2:has-text("Create New Class")')).not.toBeVisible({ timeout: 5000 });
    
    // Verify class was not created
    await expect(page.locator('text=Test Class')).not.toBeVisible();
  });

  test('should delete a class with confirmation', async ({ page }) => {
    // Create a test class via the API (not by writing to JSON directly)
    const instructor = await page.evaluate(() => {
      return fetch('/api/auth/me', {
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include'
      }).then(r => r.json()).then(d => d.user);
    });
    
    // Create class using the API so the repository knows about it
    await page.evaluate(async (instructorId) => {
      const response = await fetch('/api/classes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          name: 'Class to Delete',
          description: 'This class will be deleted',
          createdBy: instructorId
        })
      });
      if (!response.ok) {
        throw new Error(`Failed to create class: ${response.status}`);
      }
      return response.json();
    }, instructor.id);
    
    // Reload page to show the new class
    await page.reload();
    await expect(page.locator('text=Class to Delete')).toBeVisible({ timeout: 10000 });
    
    // Find the card and hover to reveal delete button
    const classCard = page.locator('button').filter({ hasText: 'Class to Delete' });
    await classCard.hover();
    
    // Wait for transition
    await page.waitForTimeout(500);
    
    // Set up dialog handler BEFORE clicking delete
    page.on('dialog', dialog => dialog.accept());
    
    // The delete button uses opacity-0 group-hover:opacity-100 for animation
    // Playwright's actionability checks reject elements with opacity 0, even though
    // the hover event was sent and a real user would see the button.
    // force: true is appropriate here because:
    // 1. The button exists and is positioned correctly
    // 2. Real users CAN see and click it after hovering
    // 3. This is testing the delete functionality, not hover animations
    const deleteButton = page.locator('button[title="Delete class"]');
    await deleteButton.click({ force: true });
    
    // Wait for deletion to process
    await page.waitForTimeout(1000);
    
    // Verify class is removed from list
    await expect(page.locator('text=Class to Delete')).not.toBeVisible({ timeout: 5000 });
    
    // Verify deletion persisted - reload and check
    await page.reload();
    await expect(page.locator('text=Class to Delete')).not.toBeVisible({ timeout: 10000 });
  });

  test('should handle multiple classes', async ({ page }) => {
    // Create first class
    let createButton = page.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
    await createButton.click();
    await expect(page.locator('h2:has-text("Create New Class")')).toBeVisible();
    await page.fill('input#class-name', 'CS 101');
    await page.click('button:has-text("Create Class")');
    await expect(page.locator('h2:has-text("Create New Class")')).not.toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=CS 101')).toBeVisible();
    
    // Create second class
    createButton = page.locator('button:has-text("New Class")').first();
    await createButton.click();
    await expect(page.locator('h2:has-text("Create New Class")')).toBeVisible();
    await page.fill('input#class-name', 'CS 202');
    await page.click('button:has-text("Create Class")');
    await expect(page.locator('h2:has-text("Create New Class")')).not.toBeVisible({ timeout: 5000 });
    
    // Verify both classes appear
    await expect(page.locator('text=CS 101')).toBeVisible();
    await expect(page.locator('text=CS 202')).toBeVisible();
    
    // Verify persistence
    await page.reload();
    await expect(page.locator('text=CS 101')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=CS 202')).toBeVisible();
  });

  test('should navigate to sections view when clicking a class', async ({ page }) => {
    // Create a class first
    const createButton = page.locator('button:has-text("New Class"), button:has-text("Create Your First Class")').first();
    await createButton.click();
    await expect(page.locator('h2:has-text("Create New Class")')).toBeVisible();
    await page.fill('input#class-name', 'CS 101');
    await page.fill('textarea#class-description', 'Intro to CS');
    await page.click('button:has-text("Create Class")');
    await expect(page.locator('h2:has-text("Create New Class")')).not.toBeVisible({ timeout: 5000 });
    
    // Click on the class card button
    const classCardButton = page.locator('button').filter({ hasText: 'CS 101' }).filter({ hasText: 'Intro to CS' });
    await classCardButton.click();
    
    // Verify navigation to sections view
    await expect(page.locator('h2:has-text("CS 101")')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=Select a section to view and manage sessions')).toBeVisible();
    
    // Verify "Back to Classes" button exists
    await expect(page.locator('button:has-text("Back to Classes")')).toBeVisible();
    
    // Click back and verify return to classes view
    await page.click('button:has-text("Back to Classes")');
    await expect(page.locator('h2:has-text("Your Classes")')).toBeVisible({ timeout: 5000 });
  });
});
