/**
 * E2E tests for system admin core flows
 *
 * Tests the essential system admin functionality:
 * 1. Create namespace
 * 2. Create user within namespace and manage their role
 *
 * These tests are intentionally minimal to reduce maintenance burden.
 */

import { test, expect } from './helpers/setup';
import { 
  loginAsSystemAdmin,
  generateTestNamespaceId,
  cleanupNamespace 
} from './fixtures/auth-helpers';

test.describe('System Admin Core Flows', () => {
  test('System admin can create namespace and manage users', async ({ page }) => {
    // Generate unique namespace ID for this test
    const namespaceId = generateTestNamespaceId();

    try {
      // Sign in as system admin
      await loginAsSystemAdmin(page, `sysadmin-${namespaceId}`);

    // Should redirect to system admin dashboard
    await expect(page).toHaveURL('/system');
    await expect(page.locator('h1:has-text("System Administration")')).toBeVisible({ timeout: 5000 });

    // Verify we can see the namespace management UI
    await expect(page.locator('h2:has-text("Namespaces")')).toBeVisible();

      // Create a new namespace using the pre-generated ID
    await page.fill('input#namespace-id', namespaceId);
    await page.fill('input#display-name', 'Test Organization');

    // Submit the form
    await page.click('button:has-text("Create Namespace")');

    // Wait for success - namespace should appear in the list
    await expect(page.locator(`text=${namespaceId}`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h3:has-text("Test Organization")').first()).toBeVisible();

    // Click "Manage Users" for the new namespace
    // Note: Using .first() since we're testing with a clean database
    await page.getByRole('button', { name: 'Manage Users' }).first().click();

    // Should navigate to user management page
    await expect(page).toHaveURL(`/system/namespaces/${namespaceId}`);
    await expect(page.locator('text=Test Organization')).toBeVisible();

    // Create a new user in the namespace
    await page.click('button:has-text("Create New User")');

    // Wait for form to appear
    await expect(page.locator('input[placeholder="Enter username"]')).toBeVisible();

    const testUsername = `testuser-${Date.now()}`;
    await page.locator('input[placeholder="Enter username"]').fill(testUsername);
    await page.selectOption('select', 'instructor');

    // Listen for the API response
    const responsePromise = page.waitForResponse(resp =>
      resp.url().includes(`/api/system/namespaces/${namespaceId}/users`) && resp.request().method() === 'POST'
    );

    // Submit user creation form
    await page.locator('form').locator('button:has-text("Create User")').click();

    // Wait for and check the API response
    const response = await responsePromise;
    const responseBody = await response.json();
    if (!response.ok()) {
      throw new Error(`User creation API failed: ${response.status()} - ${JSON.stringify(responseBody)}`);
    }

    // Wait for form to close (user created successfully)
    await expect(page.locator('input[placeholder="Enter username"]')).not.toBeVisible({ timeout: 5000 });

    // Reload the page to force a fresh fetch
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify user appears in the list
    await expect(page.locator(`h3:has-text("${testUsername}")`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('text=instructor')).toBeVisible();

    // Change the user's role
    const userCard = page.locator(`div:has-text("${testUsername}")`).first();
    await userCard.locator('button:has-text("Change Role")').click();

    // Select new role
    await userCard.locator('select').selectOption('namespace-admin');
    await userCard.locator('button:has-text("Save")').click();

    // Verify role changed
    await expect(userCard.locator('text=namespace-admin')).toBeVisible({ timeout: 5000 });

    // Navigate back to system dashboard
    await page.click('button:has-text("Back to System Admin")');
    await expect(page).toHaveURL('/system');

    // Verify namespace still shows in the list
    await expect(page.locator(`text=${namespaceId}`)).toBeVisible();
    } finally {
      // Clean up the namespace after test
      await cleanupNamespace(namespaceId);
    }
  });
});
