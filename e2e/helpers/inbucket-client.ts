/**
 * Mailpit Email Client for E2E Testing
 *
 * Mailpit is the email testing service that Supabase local development uses.
 * It provides a REST API to retrieve emails sent during testing.
 *
 * Default URL: http://localhost:54324 (Supabase's Mailpit instance)
 */

const MAILPIT_URL = process.env.MAILPIT_URL || process.env.INBUCKET_URL || 'http://localhost:54324';

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

interface MailpitAddress {
  Name: string;
  Address: string;
}

interface MailpitListItem {
  ID: string;
  From: MailpitAddress;
  To: MailpitAddress[];
  Subject: string;
  Created: string;
  Size: number;
}

interface MailpitMessage {
  ID: string;
  From: MailpitAddress;
  To: MailpitAddress[];
  Subject: string;
  Date: string;
  Text: string;
  HTML: string;
}

interface MailpitListResponse {
  total: number;
  messages: MailpitListItem[];
}

/**
 * Convert Mailpit message to our standard format
 */
function convertMailpitMessage(msg: MailpitMessage): InbucketEmail {
  return {
    id: msg.ID,
    from: msg.From.Address,
    to: msg.To.map(t => t.Address),
    subject: msg.Subject,
    date: msg.Date,
    body: {
      text: msg.Text,
      html: msg.HTML,
    },
  };
}

/**
 * List all emails for a recipient
 * Mailpit stores all emails in a single inbox, so we filter by recipient
 */
export async function listEmails(email: string): Promise<{ id: string; from: string; to: string[]; subject: string; date: string; size: number }[]> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`);

  if (!response.ok) {
    if (response.status === 404) {
      return [];
    }
    throw new Error(`Failed to list emails: ${response.status} ${response.statusText}`);
  }

  const data: MailpitListResponse = await response.json();

  // Filter by recipient email
  const filtered = data.messages.filter(m =>
    m.To.some(t => t.Address.toLowerCase() === email.toLowerCase())
  );

  return filtered.map(m => ({
    id: m.ID,
    from: m.From.Address,
    to: m.To.map(t => t.Address),
    subject: m.Subject,
    date: m.Created,
    size: m.Size,
  }));
}

/**
 * Get a specific email by ID
 */
export async function getEmail(email: string, messageId: string): Promise<InbucketEmail> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/message/${messageId}`);

  if (!response.ok) {
    throw new Error(`Failed to get email: ${response.status} ${response.statusText}`);
  }

  const msg: MailpitMessage = await response.json();
  return convertMailpitMessage(msg);
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
  let lastCheckCount = 0;

  while (Date.now() - startTime < timeout) {
    const messages = await listEmails(email);

    // Log on first check or when count changes
    if (messages.length !== lastCheckCount) {
      console.log(`[waitForEmail] Found ${messages.length} emails for ${email}`);
      if (messages.length > 0) {
        console.log(`[waitForEmail] Subjects: ${messages.map(m => m.subject).join(', ')}`);
      }
      lastCheckCount = messages.length;
    }

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

  console.log(`[waitForEmail] Timeout waiting for email to ${email}`);
  return null;
}

/**
 * Extract the OTP code from a Supabase verification email
 * Supabase OTP emails contain a 6-digit code
 *
 * @param emailContent - The email body (HTML or text)
 * @returns The extracted OTP code, or null if not found
 */
export function extractOtpCode(emailContent: InbucketEmail): string | null {
  // Try HTML body first, then text
  const content = emailContent.body.html || emailContent.body.text;

  // Look for 6-digit codes (OTP pattern)
  // Supabase typically formats it as a standalone 6-digit number
  const otpPatterns = [
    // Code in a heading or paragraph
    />\s*(\d{6})\s*</,
    // Code on its own line
    /\b(\d{6})\b/,
  ];

  for (const pattern of otpPatterns) {
    const match = content.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
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
  // Pattern matches URLs with token parameter (used by Supabase)
  const urlPatterns = [
    // Verification URL with token (Supabase format)
    /https?:\/\/[^\s"<>]+\/auth\/v1\/verify\?token=[^\s"<>&]+[^\s"<>]*/gi,
    // Magic link with token_hash
    /https?:\/\/[^\s"<>]+token_hash=[^\s"<>&]+/gi,
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
 * Clear all emails in a mailbox (delete all emails for a recipient)
 * Mailpit doesn't support per-mailbox deletion, so we delete matching emails individually
 */
export async function clearMailbox(email: string): Promise<void> {
  const messages = await listEmails(email);

  for (const msg of messages) {
    await deleteEmail(email, msg.id);
  }
}

/**
 * Delete a specific email
 */
export async function deleteEmail(_email: string, messageId: string): Promise<void> {
  const response = await fetch(`${MAILPIT_URL}/api/v1/messages`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ ids: [messageId] }),
  });

  if (!response.ok && response.status !== 404) {
    throw new Error(`Failed to delete email: ${response.status} ${response.statusText}`);
  }
}
