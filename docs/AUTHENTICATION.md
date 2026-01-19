# Authentication Architecture

## Overview

coding-tool uses Supabase Auth for authentication with email/password. This provides:
- Secure password hashing (bcrypt)
- JWT-based sessions
- Automatic session refresh
- Row Level Security (RLS) integration

## Architecture

### Components

1. **auth.users (Supabase):** Core user accounts with email/password
2. **user_profiles (Application):** Extended user data (username, role, namespace)
3. **SupabaseAuthProvider:** Server-side auth implementation  
4. **AuthContext:** Client-side React context for auth state
5. **Middleware:** Auto-refreshes JWT sessions on every request

### Authentication Flow

**Registration:**
1. User submits email, password, username via /auth/register
2. POST /api/auth/register validates and calls SupabaseAuthProvider.signUp()
3. Creates auth.users row via Supabase Admin API
4. Creates user_profiles row with role and namespace
5. Auto signs in and redirects to role-appropriate page

**Sign-in:**
1. User submits email, password via /auth/signin
2. POST /api/auth/signin calls SupabaseAuthProvider.authenticateWithPassword()
3. Supabase validates credentials and returns JWT tokens
4. JWT tokens stored in httpOnly cookies (sb-access-token, sb-refresh-token)
5. User redirected based on role

**Session Management:**
1. Middleware runs on every request
2. Calls supabase.auth.getSession() which auto-refreshes if needed
3. Protected API routes read session via getSessionFromRequest()
4. Frontend reads user via /api/auth/me

**Sign-out:**
1. User clicks sign out
2. POST /api/auth/signout calls supabase.auth.signOut()
3. Clears JWT cookies
4. Redirects to sign-in page

### Security

- Passwords hashed with bcrypt (Supabase managed)
- JWT tokens signed with HS256 (Supabase managed)
- httpOnly cookies prevent XSS attacks
- Secure flag in production prevents MITM attacks
- SameSite=lax prevents CSRF attacks
- Row Level Security (RLS) enforces data isolation

### User Roles

- **system-admin:** Full access, manages namespaces and all users
- **namespace-admin:** Manages users within their namespace
- **instructor:** Creates classes, sections, problems, sessions
- **student:** Participates in sessions, submits code

### RBAC Integration

Permissions checked via RBACService:
```typescript
const { user, rbac } = await getAuthContext(request)
if (!rbac.canManageClass(user, classId)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}
```

See [src/server/auth/rbac.ts](../src/server/auth/rbac.ts) for full permission matrix.

## Development

**Testing Auth Locally:**
```bash
# Start Supabase
npx supabase start

# Reset with fresh data
npx supabase db reset

# Run integration tests
npm run test:integration

# Run E2E tests
npm run test:e2e
```

**Creating Test Users:**
```typescript
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(url, serviceRoleKey)

const { data } = await supabase.auth.admin.createUser({
  email: 'test@example.com',
  password: 'password123',
  email_confirm: true,
  user_metadata: { username: 'testuser' }
})

// Then create user_profiles row...
```

## Production Deployment

1. Create Supabase project at https://supabase.com
2. Copy project URL and keys to environment variables
3. Enable email auth in Supabase dashboard
4. Configure email templates (optional)
5. Set SYSTEM_ADMIN_EMAIL for initial admin account
6. Deploy application with environment variables
7. Register first user with SYSTEM_ADMIN_EMAIL

## Troubleshooting

**"Invalid login credentials":**
- Verify email/password are correct
- Check user exists in auth.users
- Check user_profiles row exists

**"Session expired":**
- JWT token expired (7 day limit)
- User signed out elsewhere
- Browser cleared cookies

**Realtime connection failing:**
- Check Supabase project has Realtime enabled
- Verify NEXT_PUBLIC_SUPABASE_URL is correct
- Check browser console for connection errors
