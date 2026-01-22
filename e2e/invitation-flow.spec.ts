/**
 * E2E Tests for Invitation Flows
 *
 * Tests the critical paths for email-based invitations:
 * 1. System admin creates namespace-admin invitation
 * 2. Namespace admin creates instructor invitation
 * 3. Resend invitation generates new email
 *
 * These tests use Inbucket (Supabase's local email testing service)
 * to verify actual email delivery and link extraction.
 *
 * NOTE: These tests require Supabase to be running with proper credentials.
 * They will be skipped if SUPABASE_SECRET_KEY is not set.
 */

import { test, expect } from './helpers/setup';
import { hasSupabaseCredentials, generateTestNamespaceId, cleanupNamespace } from './helpers/db-helpers';
import { loginAsSystemAdmin, signInAs } from './fixtures/auth-helpers';
import { getSupabaseAdmin, createTestClass, createTestSection } from './helpers/test-data';
import { waitForEmail, extractInviteLink, clearMailbox, listEmails, getEmail, type InbucketEmail } from './helpers/inbucket-client';

// Skip E2E tests if Supabase is not configured
// UI implementation is complete (coding-tool-tu6):
// - /system page has invitation creation form for namespace-admin invitations
// - /namespace/invitations page exists for instructor invitations
const skipInvitationTests = false;
const describeE2E = (hasSupabaseCredentials() && !skipInvitationTests) ? test.describe : test.describe.skip;

describeE2E('Invitation Flows', () => {
  test('System admin can create and send namespace-admin invitation via email', async ({ page }) => {
    const namespaceId = generateTestNamespaceId();
    const inviteeEmail = `invite-nsadmin-${Date.now()}@test.local`;

    try {
      // Clear any existing emails for this address
      await clearMailbox(inviteeEmail);

      // Sign in as system admin
      await loginAsSystemAdmin(page, `sysadmin-${namespaceId}`);

      // Wait for redirect to system admin dashboard
      await expect(page).toHaveURL('/system', { timeout: 10000 });
      await expect(page.locator('h1:has-text("System Administration")')).toBeVisible({ timeout: 5000 });

      // First, create a namespace for the invitation
      await page.click('button:has-text("Create New Namespace")');
      await expect(page.locator('input#namespace-id')).toBeVisible({ timeout: 5000 });
      await page.fill('input#namespace-id', namespaceId);
      await page.fill('input#display-name', 'Test Invitation Org');
      await page.click('button:has-text("Create Namespace")');

      // Wait for namespace to be created
      await expect(page.locator(`text=${namespaceId}`)).toBeVisible({ timeout: 5000 });

      // Switch to Invitations tab
      await page.click('button:has-text("Invitations")');
      await expect(page.locator('h2:has-text("Invitations")')).toBeVisible({ timeout: 5000 });

      // Click Create Invitation button
      await page.click('button:has-text("Create Invitation")');

      // Fill out the invitation form
      await expect(page.locator('#invite-email')).toBeVisible({ timeout: 5000 });
      await page.fill('#invite-email', inviteeEmail);

      // Select namespace from dropdown (use specific form ID, not filter dropdown)
      await page.selectOption('#invite-namespace', namespaceId);

      // Select namespace-admin role
      await page.selectOption('#invite-role', 'namespace-admin');

      // Record time before sending (for email filtering)
      const beforeSend = new Date();

      // Submit the invitation
      await page.click('button[type="submit"]:has-text("Send Invitation")');

      // Wait for success - form should close and invitation should appear in table
      await expect(page.locator(`td:has-text("${inviteeEmail}")`)).toBeVisible({ timeout: 10000 });
      console.log('Invitation created successfully');

      // Wait for email to arrive in Inbucket
      console.log(`Waiting for email to arrive for ${inviteeEmail}...`);
      const email = await waitForEmail(inviteeEmail, {
        timeout: 30000,
        afterDate: beforeSend,
        subjectContains: 'invite',
      });

      expect(email).not.toBeNull();
      console.log(`Email received: ${email!.subject}`);

      // Extract the invite link from the email
      const inviteLink = extractInviteLink(email!);
      expect(inviteLink).not.toBeNull();
      console.log(`Invite link extracted: ${inviteLink}`);

      // Verify the link format (Supabase verify URL with token and type=invite)
      expect(inviteLink).toMatch(/\/auth\/v1\/verify\?token=/);
      expect(inviteLink).toMatch(/type=invite/);

      console.log('System admin namespace-admin invitation flow completed successfully!');
    } finally {
      // Cleanup
      await cleanupNamespace(namespaceId);
    }
  });

  test('Namespace admin can create instructor invitation via email', async ({ page }) => {
    const namespaceId = generateTestNamespaceId();
    const supabase = getSupabaseAdmin();
    const inviteeEmail = `invite-instructor-${Date.now()}@test.local`;

    try {
      // Setup: Create namespace and namespace-admin user
      const { error: nsError } = await supabase.from('namespaces').insert({
        id: namespaceId,
        display_name: 'Test Instructor Invite Org',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (nsError) throw new Error(`Failed to create namespace: ${nsError.message}`);

      // Clear any existing emails
      await clearMailbox(inviteeEmail);

      // Sign in as namespace admin directly
      await signInAs(page, `nsadmin-${namespaceId}`, 'namespace-admin', namespaceId);

      // Navigate to namespace invitations page
      await page.goto('/namespace/invitations');

      // Wait for page to load
      await expect(page.locator('h1:has-text("Manage Invitations")')).toBeVisible({ timeout: 10000 });

      // Click to show the invitation form
      await page.click('button:has-text("Invite Instructor")');

      // Fill out the invitation form
      await expect(page.locator('input#email')).toBeVisible({ timeout: 5000 });
      await page.fill('input#email', inviteeEmail);

      // Record time before sending
      const beforeSend = new Date();

      // Send invitation
      await page.click('button:has-text("Send Invitation")');

      // Wait for success message
      await expect(page.locator(`text=Invitation sent to ${inviteeEmail}`)).toBeVisible({ timeout: 10000 });
      console.log('Instructor invitation sent');

      // Wait for email
      console.log(`Waiting for email to arrive for ${inviteeEmail}...`);
      const email = await waitForEmail(inviteeEmail, {
        timeout: 30000,
        afterDate: beforeSend,
        subjectContains: 'invite',
      });

      expect(email).not.toBeNull();
      console.log(`Email received: ${email!.subject}`);

      // Extract and verify invite link exists
      const inviteLink = extractInviteLink(email!);
      expect(inviteLink).not.toBeNull();
      console.log(`Invite link found: ${inviteLink?.substring(0, 50)}...`);

      console.log('Namespace admin instructor invitation flow completed successfully!');
    } finally {
      await cleanupNamespace(namespaceId);
    }
  });

  test('Resend invitation generates new email', async ({ page }) => {
    const namespaceId = generateTestNamespaceId();
    const supabase = getSupabaseAdmin();
    const inviteeEmail = `invite-resend-${Date.now()}@test.local`;

    try {
      // Setup: Create namespace
      const { error: nsError } = await supabase.from('namespaces').insert({
        id: namespaceId,
        display_name: 'Test Resend Invite Org',
        active: true,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });
      if (nsError) throw new Error(`Failed to create namespace: ${nsError.message}`);

      // Clear any existing emails
      await clearMailbox(inviteeEmail);

      // Sign in as namespace admin directly
      await signInAs(page, `nsadmin-resend-${namespaceId}`, 'namespace-admin', namespaceId);

      // Navigate to invitations page
      await page.goto('/namespace/invitations');
      await expect(page.locator('h1:has-text("Manage Invitations")')).toBeVisible({ timeout: 10000 });

      // Click to show the invitation form
      await page.click('button:has-text("Invite Instructor")');

      // Create initial invitation
      await expect(page.locator('input#email')).toBeVisible({ timeout: 5000 });
      await page.fill('input#email', inviteeEmail);
      await page.click('button:has-text("Send Invitation")');

      // Wait for first invitation to appear in the table (use td to avoid matching toast)
      await expect(page.locator(`td:has-text("${inviteeEmail}")`)).toBeVisible({ timeout: 10000 });

      // Wait for first email
      console.log('Waiting for initial email...');
      const firstEmail = await waitForEmail(inviteeEmail, {
        timeout: 30000,
        subjectContains: 'invite',
      });
      expect(firstEmail).not.toBeNull();
      const firstEmailTime = new Date(firstEmail!.date);
      console.log(`First email received at ${firstEmailTime.toISOString()}`);

      // Small delay to ensure distinct timestamps
      await page.waitForTimeout(2000);

      // Click Resend button for this invitation (sends immediately, no confirmation)
      const invitationRow = page.locator(`tr:has-text("${inviteeEmail}")`).first();
      const resendButton = invitationRow.locator('button:has-text("Resend")');
      await resendButton.click();

      // Wait for the button text to change to "Sending..." then back to "Resend"
      // This indicates the API call has completed
      await expect(resendButton).toHaveText('Resend', { timeout: 10000 });

      // Wait for second email to arrive - poll until we have 2 emails total
      console.log('Waiting for resent email...');
      let emails: InbucketEmail[] = [];
      const startTime = Date.now();
      const timeout = 30000;

      while (Date.now() - startTime < timeout) {
        // Get all invite emails for this recipient
        const allEmails = await listEmails(inviteeEmail);
        const inviteEmails = allEmails.filter(e => e.subject.toLowerCase().includes('invite'));

        if (inviteEmails.length >= 2) {
          // Get full email details for verification
          emails = await Promise.all(inviteEmails.map(e => getEmail(inviteeEmail, e.id)));
          break;
        }
        await page.waitForTimeout(1000);
      }

      expect(emails.length).toBeGreaterThanOrEqual(2);
      console.log(`Found ${emails.length} invite emails after resend`);

      // Verify the latest email has a valid invite link
      const sortedEmails = emails.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      const latestEmail = sortedEmails[0];
      const newInviteLink = extractInviteLink(latestEmail);
      expect(newInviteLink).not.toBeNull();
      console.log('Resend invitation generated new email with valid link!');
    } finally {
      await cleanupNamespace(namespaceId);
    }
  });
});
