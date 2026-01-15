/**
 * Inbucket Email Client for E2E Testing
 *
 * Inbucket is the email testing service that Supabase local development uses.
 * It provides a REST API to retrieve emails sent during testing.
 *
 * Default URL: http://localhost:54324 (Supabase's Inbucket instance)
 */

const INBUCKET_URL = process.env.INBUCKET_URL || 'http://localhost:54324';

export interface InbucketEmail {
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  body: {
    text: string;
    html: string;
  };
}

interface InbucketListItem {
  id: string;
  from: string;
  to: string[];
  subject: string;
  date: string;
  size: number;
}

/**
 * Get the mailbox name from an email address
 * Inbucket uses the local part of the email (before @) as the mailbox name
 */
function getMailboxName(email: string): string {
  return email.split('@')[0];
}

/**
 * List all emails in a mailbox
 */
export async function listEmails(email: string): Promise<InbucketListItem[]> {
  const mailbox = getMailboxName(email);
  const response = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}`);

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to list emails: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get a specific email by ID
 */
export async function getEmail(email: string, messageId: string): Promise<InbucketEmail> {
  const mailbox = getMailboxName(email);
  const response = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}/${messageId}`);

  if (!response.ok) {
    throw new Error(`Failed to get email: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * Get the latest email in a mailbox
 * Returns null if no emails exist
 */
export async function getLatestEmail(email: string): Promise<InbucketEmail | null> {
  const messages = await listEmails(email);

  if (messages.length === 0) {
    return null;
  }

  // Sort by date descending and get the most recent
  const sorted = messages.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const latest = sorted[0];

  return getEmail(email, latest.id);
}

/**
 * Wait for an email to arrive in the mailbox
 * Polls until an email is found or timeout is reached
 *
 * @param email - Email address to check
 * @param options - Options for waiting
 * @returns The latest email, or null if timeout reached
 */
export async function waitForEmail(
  email: string,
  options: {
    timeout?: number;
    pollInterval?: number;
    afterDate?: Date;
    subjectContains?: string;
  } = {}
): Promise<InbucketEmail | null> {
  const {
    timeout = 30000,
    pollInterval = 1000,
    afterDate,
    subjectContains,
  } = options;

  const startTime = Date.now();

  while (Date.now() - startTime < timeout) {
    const messages = await listEmails(email);

    // Filter by date if specified
    let filtered = messages;
    if (afterDate) {
      filtered = filtered.filter(m => new Date(m.date) > afterDate);
    }

    // Filter by subject if specified
    if (subjectContains) {
      filtered = filtered.filter(m => m.subject.toLowerCase().includes(subjectContains.toLowerCase()));
    }

    if (filtered.length > 0) {
      // Sort by date descending and get the most recent
      const sorted = filtered.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
      return getEmail(email, sorted[0].id);
    }

    // Wait before polling again
    await new Promise(resolve => setTimeout(resolve, pollInterval));
  }

  return null;
}

/**
 * Extract the invite/magic link from an email
 * Supabase invitation emails contain a link to verify the invitation
 *
 * @param emailContent - The email body (HTML or text)
 * @returns The extracted URL, or null if not found
 */
export function extractInviteLink(emailContent: InbucketEmail): string | null {
  // Try HTML body first, then text
  const content = emailContent.body.html || emailContent.body.text;

  // Look for Supabase confirmation/invite URLs
  // Pattern matches URLs with token_hash parameter (used by Supabase)
  const urlPatterns = [
    // Magic link with token_hash
    /https?:\/\/[^\s"<>]+token_hash=[^\s"<>&]+/gi,
    // Confirmation URL pattern
    /https?:\/\/[^\s"<>]+\/auth\/v1\/verify[^\s"<>]*/gi,
    // Generic invite URL pattern
    /https?:\/\/[^\s"<>]+\/invite\/accept[^\s"<>]*/gi,
    // Fallback: any URL with type=invite
    /https?:\/\/[^\s"<>]+type=invite[^\s"<>&]*/gi,
  ];

  for (const pattern of urlPatterns) {
    const matches = content.match(pattern);
    if (matches && matches.length > 0) {
      // Clean up the URL (remove trailing punctuation, HTML entities)
      let url = matches[0]
        .replace(/&amp;/g, '&')
        .replace(/[<>"'\s]+$/, '');
      return url;
    }
  }

  return null;
}

/**
 * Clear all emails in a mailbox
 */
export async function clearMailbox(email: string): Promise<void> {
  const mailbox = getMailboxName(email);
  const response = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to clear mailbox: ${response.status} ${response.statusText}`);
  }
}

/**
 * Delete a specific email
 */
export async function deleteEmail(email: string, messageId: string): Promise<void> {
  const mailbox = getMailboxName(email);
  const response = await fetch(`${INBUCKET_URL}/api/v1/mailbox/${mailbox}/${messageId}`, {
    method: 'DELETE',
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete email: ${response.status} ${response.statusText}`);
  }
}
