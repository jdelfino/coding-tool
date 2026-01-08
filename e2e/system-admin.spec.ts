/**
 * E2E tests for system admin core flows
 *
 * Tests the essential system admin functionality:
 * 1. Create namespace
 * 2. Create user within namespace and manage their role
 *
 * These tests are intentionally minimal to reduce maintenance burden.
 *
 * NOTE: These tests require Supabase to be running with proper credentials.
 * They will be skipped if SUPABASE_SERVICE_ROLE_KEY is not set.
 */

import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials } from './helpers/db-helpers';
import {
  loginAsSystemAdmin,
  generateTestNamespaceId,
  cleanupNamespace
} from './fixtures/auth-helpers';

// Skip E2E tests if Supabase is not configured
const describeE2E = hasSupabaseCredentials() ? test.describe : test.describe.skip;

describeE2E('System Admin Core Flows', () => {
  test('System admin can create namespace and manage users', async ({ page }) => {
    // Generate unique namespace ID for this test
    const namespaceId = generateTestNamespaceId();

    try {
      // Sign in as system admin
      await loginAsSystemAdmin(page, `sysadmin-${namespaceId}`);

    // Wait for redirect to system admin dashboard
    await expect(page).toHaveURL('/system', { timeout: 5000 });
    await expect(page.locator('h1:has-text("System Administration")')).toBeVisible({ timeout: 5000 });

    // Verify we can see the namespace management UI
    await expect(page.locator('h2:has-text("Namespaces")')).toBeVisible();

    // Click to open create namespace form
    await page.click('button:has-text("Create New Namespace")');

    // Wait for form to appear and fill it
    await expect(page.locator('input#namespace-id')).toBeVisible({ timeout: 5000 });
    await page.fill('input#namespace-id', namespaceId);
    await page.fill('input#display-name', 'Test Organization');

    // Submit the form
    await page.click('button:has-text("Create Namespace")');

    // Wait for success - namespace should appear in the list
    await expect(page.locator(`text=${namespaceId}`)).toBeVisible({ timeout: 5000 });
    await expect(page.locator('h3:has-text("Test Organization")').first()).toBeVisible();

    // Click "Manage Users" for the new namespace specifically
    // Wait for our namespace to appear and scroll it into view if needed
    await page.locator(`text=${namespaceId}`).scrollIntoViewIfNeeded();

    // Find the card containing our namespace ID and click its Manage Users button
    // Use a more direct selector approach
    const manageUsersButtons = await page.locator('button:has-text("Manage Users")').all();
    // Our namespace should be the last one created (most recent)
    const lastButton = manageUsersButtons[manageUsersButtons.length - 1];
    await lastButton.click();

    // Should navigate to user management page
    await expect(page).toHaveURL(`/system/namespaces/${namespaceId}`);
    await expect(page.locator('text=Test Organization')).toBeVisible();

    // Create a new user in the namespace
    await page.click('button:has-text("Create New User")');

    // Wait for form to appear
    await expect(page.locator('input[placeholder="Enter email"]')).toBeVisible();

    const testUsername = `testuser-${Date.now()}`;
    const testEmail = `${testUsername}@test.local`;
    const testPassword = 'TestPassword123!';
    await page.locator('input[placeholder="Enter email"]').fill(testEmail);
    await page.locator('input[placeholder="Enter username"]').fill(testUsername);
    await page.locator('input[placeholder="Enter password"]').fill(testPassword);
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
    await expect(page.locator('input[placeholder="Enter email"]')).not.toBeVisible({ timeout: 10000 });

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
