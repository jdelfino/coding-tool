import { test, expect } from './helpers/setup';
import { loginAsInstructor } from './fixtures/auth-helpers';

/**
 * E2E tests for instructor problem creation workflows
 * Tests: create, edit, delete problems
 * 
 * These tests verify the problem CRUD operations and catch
 * modal rendering/form validation bugs.
 */

test.describe('Instructor Problem Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as instructor before each test
    await loginAsInstructor(page, 'test-instructor');
    
    // Navigate to instructor dashboard
    await page.goto('/instructor');
    
    // Wait for page to load
    await expect(page.locator('h2:has-text("Your Classes"), h3:has-text("No Classes Yet")')).toBeVisible({ timeout: 10000 });
    
    // Navigate to problems section
    await page.click('button:has-text("Problems")');
    
    // Wait for problems library to load
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
  });

  test('should create a problem with all fields', async ({ page }) => {
    // Click "Create New Problem" button
    await page.click('button:has-text("Create New Problem")');
    
    // Wait for problem creator form to appear
    await expect(page.locator('h1:has-text("Create New Problem"), h2:has-text("Create New Problem")')).toBeVisible({ timeout: 5000 });
    
    // Fill in all fields
    await page.fill('input#title', 'Test Problem: Sum Two Numbers');
    await page.fill('textarea#description', 'Write a function that adds two numbers together');
    
    // Fill starter code using Monaco editor
    const monacoEditor = page.locator('.monaco-editor').first();
    await monacoEditor.click();
    
    // Type starter code (Monaco has special handling)
    await page.keyboard.type('def add(a, b):\n    # TODO: implement\n    pass');
    
    // Submit the form
    await page.click('button:has-text("Save Problem"), button:has-text("Create Problem")');
    
    // Wait for form to close/redirect (back to library)
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    // Verify problem appears in the list
    await expect(page.locator('text=Test Problem: Sum Two Numbers')).toBeVisible({ timeout: 5000 });
    
    // Verify persistence - reload and check problem still exists
    await page.reload();
    await expect(page.locator('text=Test Problem: Sum Two Numbers')).toBeVisible({ timeout: 10000 });
  });

  test('should create a problem with minimal fields (title only)', async ({ page }) => {
    // Click "Create New Problem" button
    await page.click('button:has-text("Create New Problem")');
    
    // Wait for form
    await expect(page.locator('h1:has-text("Create New Problem"), h2:has-text("Create New Problem")')).toBeVisible({ timeout: 5000 });
    
    // Fill only the required title field
    await page.fill('input#title', 'Minimal Problem');
    
    // Submit form
    await page.click('button:has-text("Save Problem"), button:has-text("Create Problem")');
    
    // Wait for form to close
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    // Verify problem created successfully
    await expect(page.locator('text=Minimal Problem')).toBeVisible({ timeout: 5000 });
  });

  test('should show validation error for empty title', async ({ page }) => {
    // Click "Create New Problem" button
    await page.click('button:has-text("Create New Problem")');
    
    // Wait for form
    await expect(page.locator('h1:has-text("Create New Problem"), h2:has-text("Create New Problem")')).toBeVisible({ timeout: 5000 });
    
    // Try to submit with empty title
    const submitButton = page.locator('button:has-text("Save Problem"), button:has-text("Create Problem")');
    
    // Check if submit button is disabled or form shows validation error
    const isDisabled = await submitButton.isDisabled();
    
    if (!isDisabled) {
      // If not disabled, try clicking and expect validation error
      await submitButton.click();
      
      // Verify error message appears or form stays open
      const formStillVisible = await page.locator('h1:has-text("Create New Problem"), h2:has-text("Create New Problem")').isVisible();
      expect(formStillVisible).toBe(true);
      
      // Look for error message
      const errorVisible = await page.locator('text=/Title is required|required/i').isVisible();
      expect(errorVisible || formStillVisible).toBe(true);
    } else {
      // If disabled, that's correct validation behavior
      expect(isDisabled).toBe(true);
    }
    
    // Now fill required field and verify submission succeeds
    await page.fill('input#title', 'Valid Problem');
    await expect(submitButton).toBeEnabled();
    await submitButton.click();
    
    // Verify submission succeeded
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Valid Problem')).toBeVisible({ timeout: 5000 });
  });

  test('should edit an existing problem', async ({ page }) => {
    // First, create a test problem
    await page.click('button:has-text("Create New Problem")');
    await expect(page.locator('h1:has-text("Create New Problem"), h2:has-text("Create New Problem")')).toBeVisible({ timeout: 5000 });
    await page.fill('input#title', 'Problem to Edit');
    await page.fill('textarea#description', 'Original description');
    await page.click('button:has-text("Save Problem"), button:has-text("Create Problem")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Problem to Edit')).toBeVisible({ timeout: 5000 });
    
    // Find and click the edit button for this problem
    // The problem card likely has an edit button/icon
    const problemCard = page.locator('div, article').filter({ hasText: 'Problem to Edit' }).first();
    
    // Look for edit button (could be an icon button or "Edit" text)
    const editButton = problemCard.locator('button:has-text("Edit"), button[aria-label*="Edit"], button[title*="Edit"]').first();
    await editButton.click();
    
    // Wait for edit form to appear
    await expect(page.locator('h1:has-text("Edit Problem"), h2:has-text("Edit Problem")').or(page.locator('input#problem-title'))).toBeVisible({ timeout: 5000 });
    
    // Verify form is pre-filled with existing data
    const titleInput = page.locator('input#title');
    await expect(titleInput).toHaveValue('Problem to Edit');
    
    // Modify the fields
    await titleInput.fill('Updated Problem Title');
    await page.fill('textarea#description', 'Updated description');
    
    // Save changes
    await page.click('button:has-text("Save"), button:has-text("Update")');
    
    // Wait for return to library
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    
    // Verify updates appear in the list
    await expect(page.locator('text=Updated Problem Title')).toBeVisible({ timeout: 5000 });
    
    // Verify old title is gone
    await expect(page.locator('text=Problem to Edit')).not.toBeVisible();
  });

  test('should delete a problem with confirmation', async ({ page }) => {
    // First, create a test problem
    await page.click('button:has-text("Create New Problem")');
    await expect(page.locator('h1:has-text("Create New Problem"), h2:has-text("Create New Problem")')).toBeVisible({ timeout: 5000 });
    await page.fill('input#title', 'Problem to Delete');
    await page.fill('textarea#description', 'This will be deleted');
    await page.click('button:has-text("Save Problem"), button:has-text("Create Problem")');
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Problem to Delete')).toBeVisible({ timeout: 5000 });
    
    // Find the problem card
    const problemCard = page.locator('div, article').filter({ hasText: 'Problem to Delete' }).first();
    
    // Set up dialog handler BEFORE clicking delete (for confirmation dialog)
    page.on('dialog', dialog => {
      console.log('[Dialog] Type:', dialog.type(), 'Message:', dialog.message());
      dialog.accept();
    });
    
    // Look for delete button (could be an icon button, "Delete" text, or trash icon)
    const deleteButton = problemCard.locator('button:has-text("Delete"), button[aria-label*="Delete"], button[title*="Delete"]').first();
    
    // May need to hover to reveal delete button (similar to class management)
    await problemCard.hover();
    await page.waitForTimeout(500); // Wait for hover animation
    
    // Click delete button
    await deleteButton.click({ force: true }); // force in case of opacity animations
    
    // Wait for deletion to process
    await page.waitForTimeout(1000);
    
    // Verify problem is removed from list
    await expect(page.locator('text=Problem to Delete')).not.toBeVisible({ timeout: 5000 });
    
    // Verify deletion persisted - reload and check
    await page.reload();
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Problem to Delete')).not.toBeVisible({ timeout: 5000 });
  });

  test('should cancel problem creation', async ({ page }) => {
    // Click "Create New Problem" button
    await page.click('button:has-text("Create New Problem")');
    
    // Wait for form
    await expect(page.locator('h1:has-text("Create New Problem"), h2:has-text("Create New Problem")')).toBeVisible({ timeout: 5000 });
    
    // Fill some fields
    await page.fill('input#title', 'Problem to Cancel');
    await page.fill('textarea#description', 'This should not be saved');
    
    // Click cancel button
    await page.click('button:has-text("Cancel")');
    
    // Verify we're back at the library
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 5000 });
    
    // Verify problem was not created
    await expect(page.locator('text=Problem to Cancel')).not.toBeVisible();
    
    // Verify persistence - reload and confirm no problem
    await page.reload();
    await expect(page.locator('h2:has-text("Problem Library")')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('text=Problem to Cancel')).not.toBeVisible();
  });
});
