/**
 * E2E tests for system admin core flows
 *
 * Tests the essential system admin functionality:
 * 1. Create namespace
 * 2. View namespace and send invitation
 *
 * These tests are intentionally minimal to reduce maintenance burden.
 *
 * NOTE: These tests require Supabase to be running with proper credentials.
 * They will be skipped if SUPABASE_SECRET_KEY is not set.
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
  test('System admin can create namespace and view invitation UI', async ({ page }) => {
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

      // Verify the users list heading is shown (will be empty for new namespace)
      await expect(page.getByRole('heading', { name: /Users/ })).toBeVisible({ timeout: 5000 });

      // Navigate back to system dashboard (BackButton renders as a link when using href)
      await page.click('a:has-text("Back to System Admin")');
      await expect(page).toHaveURL('/system');

      // Verify namespace still shows in the list
      await expect(page.locator(`text=${namespaceId}`)).toBeVisible();

      // Verify Invitations tab exists and is accessible
      await page.click('button:has-text("Invitations")');
      await expect(page.locator('h2:has-text("Invitations")')).toBeVisible({ timeout: 5000 });

      // Verify Create Invitation button is available
      await expect(page.locator('button:has-text("Create Invitation")')).toBeVisible();

    } finally {
      // Clean up the namespace after test
      await cleanupNamespace(namespaceId);
    }
  });
});
