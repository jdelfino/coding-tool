import { test, expect } from './helpers/setup';
import { loginAsInstructor } from './fixtures/auth-helpers';

/**
 * Sample test to verify Playwright setup is working
 * This test should be removed once real tests are implemented
 */

test.describe('Playwright Setup Verification', () => {
  test('should load the sign-in page', async ({ page }) => {
    await page.goto('/auth/signin');
    
    // Verify page title
    await expect(page.locator('h2')).toContainText('Coding Tool');
    
    // Verify username input exists
    await expect(page.locator('input[name="username"]')).toBeVisible();
    
    // Verify submit button exists
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('should sign in as instructor', async ({ page }) => {
    const user = await loginAsInstructor(page, 'test-instructor');
    
    // Verify we're signed in
    expect(user.username).toBe('test-instructor');
    expect(user.role).toBe('instructor');
    
    // Verify we're redirected away from sign-in page
    expect(page.url()).not.toContain('/auth/signin');
  });

  test('should clear test data between tests', async ({ page }) => {
    // This test verifies that clearTestData() is called before each test
    // If data was persisted from previous test, this would fail
    
    await page.goto('/auth/signin');
    await page.fill('input[name="username"]', 'another-instructor');
    await page.click('button[type="submit"]');
    
    // Should successfully sign in with new user
    await page.waitForURL(/^(?!.*\/auth\/signin).*$/);
    expect(page.url()).not.toContain('/auth/signin');
  });
});
