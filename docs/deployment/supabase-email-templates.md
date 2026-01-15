# Supabase Email Templates

This guide covers customizing the Supabase Auth email templates for the invitation system.

## Accessing Email Templates

1. Go to your Supabase Dashboard
2. Navigate to **Authentication** → **Email Templates**
3. Select the template to customize

## Invite User Template

This template is sent when an admin invites a new instructor or namespace admin.

**Location:** Authentication → Email Templates → Invite User

### Recommended Template

**Subject:**
```
You've been invited to Coding Tool
```

**Body:**
```html
<h2>You've been invited!</h2>

<p>You've been invited to join Coding Tool as a member of an organization.</p>

<p>Click the link below to accept your invitation and set up your account:</p>

<p><a href="{{ .ConfirmationURL }}">Accept Invitation</a></p>

<p><strong>Important:</strong> This invitation link expires in 24 hours.</p>

<p>After clicking the link, you'll be able to:</p>
<ul>
  <li>Set up your username and profile</li>
  <li>See which organization you're joining</li>
  <li>Learn about your assigned role</li>
</ul>

<p>If you didn't expect this invitation, you can safely ignore this email.</p>
```

### Available Template Variables

| Variable | Description |
|----------|-------------|
| `{{ .SiteURL }}` | Your application URL (e.g., `https://yourapp.com`) |
| `{{ .ConfirmationURL }}` | The magic link URL for accepting the invitation |
| `{{ .Email }}` | The recipient's email address |

### Limitations

- Supabase templates **cannot** access custom data passed to `inviteUserByEmail()`
- Role and namespace information is shown on the accept page, not in the email
- The generic wording ("member of an organization") is intentional since we can't specify the role in the email

## Other Templates

### Confirm Signup (Not Used)

Since open registration is disabled, this template is not actively used. The system-admin bootstrap uses direct registration, not email confirmation.

### Magic Link (Not Used)

The application uses password-based authentication, not magic links for regular sign-in.

### Reset Password

If you enable password reset functionality:

**Subject:**
```
Reset your Coding Tool password
```

**Body:**
```html
<h2>Reset Your Password</h2>

<p>Click the link below to reset your password:</p>

<p><a href="{{ .ConfirmationURL }}">Reset Password</a></p>

<p>This link expires in 24 hours.</p>

<p>If you didn't request a password reset, you can safely ignore this email.</p>
```

## Testing Email Templates

1. **Local Development:** Supabase local dev captures emails in Inbucket
   - Access at `http://localhost:54324` when running `supabase start`

2. **Production:** Send a test invitation to yourself
   - Create a test invitation via the system admin UI
   - Check your email for the formatted message

## Email Delivery Configuration

By default, Supabase uses its built-in email delivery service. For production:

1. **Rate Limits:** Supabase has default rate limits on emails
2. **Custom SMTP:** For higher volumes, configure custom SMTP in Supabase Dashboard → Settings → Auth → SMTP Settings
3. **Sender Address:** Configure the "from" address in Auth settings

## Troubleshooting

### Emails not arriving

1. Check spam/junk folders
2. Verify email address is correct
3. Check Supabase Dashboard → Auth → Users for failed invitations
4. Review Supabase logs for email delivery errors

### Template changes not appearing

1. Email templates are cached - wait a few minutes
2. Clear browser cache and try again
3. Test with a new email address

### Invitation link not working

1. Link may have expired (24-hour limit)
2. Link may have already been used
3. Check that `{{ .ConfirmationURL }}` is correctly placed in template
