# Development Setup Guide

## Prerequisites

| Software | Version | Verify |
|----------|---------|--------|
| Node.js | 18+ | `node --version` |
| npm | 9+ | `npm --version` |
| Python 3 | 3.8+ | `python3 --version` |
| Docker | Latest | `docker --version` |
| Git | Latest | `git --version` |

**Note:** Docker is required for local Supabase. Python must be accessible as `python3`.

## Quick Setup

```bash
# 1. Clone repository
git clone https://github.com/jdelfino/coding-tool.git
cd coding-tool

# 2. Install dependencies
npm install

# 3. Start local Supabase (requires Docker)
npx supabase start

# 4. Configure environment
cp .env.example .env.local
# Edit .env.local with keys from supabase start output

# 5. Reset database with migrations and seed data
npx supabase db reset

# 6. Start development server
npm run dev
```

## Environment Configuration

Create `.env.local` with these values (from `npx supabase start` output):

```bash
# Required
NEXT_PUBLIC_SUPABASE_URL=http://localhost:54321
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=<anon-key>
SUPABASE_SECRET_KEY=<service-role-key>

# Optional
SYSTEM_ADMIN_EMAIL=admin@example.com  # Auto-promotes to system-admin
GEMINI_API_KEY=                        # For AI Walkthrough feature
```

## Test Users

After running `npx supabase db reset`:

| Email | Password | Role |
|-------|----------|------|
| admin@test.local | password123 | system-admin |
| instructor@test.local | password123 | instructor |
| student1@test.local | password123 | student |

## Development Commands

```bash
npm run dev              # Start dev server (http://localhost:3000)
npm test                 # Run Jest tests
npm run test:watch       # Tests in watch mode
npm run test:coverage    # Coverage report
npm run test:e2e         # Playwright E2E tests
npm run lint             # ESLint
npx tsc --noEmit         # Type check

# Supabase
npx supabase start       # Start local instance
npx supabase stop        # Stop local instance
npx supabase db reset    # Reset with migrations + seed
npx supabase studio      # Open Studio UI (http://localhost:54323)
```

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes (REST endpoints)
│   ├── instructor/        # Instructor pages
│   ├── student/           # Student pages
│   ├── admin/             # Admin pages
│   ├── system/            # System admin pages
│   ├── classes/           # Class management
│   ├── sections/          # Section management
│   └── auth/              # Auth pages
├── server/                # Backend logic (runs server-side)
│   ├── persistence/       # Supabase repositories
│   │   └── supabase/     # Supabase implementations
│   ├── auth/             # Auth & RBAC
│   ├── classes/          # Class/Section logic
│   ├── services/         # Business services
│   └── types/            # TypeScript types
├── hooks/                 # React hooks
├── contexts/              # React contexts
└── components/            # Shared components

supabase/
├── migrations/            # Database migrations
└── seed.sql              # Seed data
```

## Making Changes

### API Routes
- Edit `src/app/api/**/route.ts`
- Use repository pattern from `src/server/persistence/`
- Auth: Use `createServerAuthChecker()` for auth validation

### Frontend
- Edit `src/app/**/page.tsx` or components
- Next.js hot-reloads automatically
- Use hooks from `src/hooks/`

### Database
- Add migrations: `npx supabase migration new <name>`
- Edit `supabase/migrations/*.sql`
- Apply: `npx supabase db reset`

### Types
- Backend types: `src/server/types.ts`, `src/server/classes/types.ts`
- Persistence types: `src/server/persistence/types.ts`
- Run `npx tsc --noEmit` to verify

## Testing

### Running Tests

```bash
# All tests
npm test

# Single file
npm test -- src/server/code-executor.test.ts

# Pattern matching
npm test -- -t "executeCode"

# Watch mode
npm run test:watch
```

### E2E Tests

E2E tests require running Supabase:

```bash
npx supabase start
source .env.local
npx playwright install chromium  # First time only
npm run test:e2e
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | `lsof -ti:3000 \| xargs kill -9` |
| Python not found | Ensure `python3` is in PATH |
| Supabase won't start | Check Docker is running |
| Type errors | Run `npx tsc --noEmit` |
| Hot reload broken | Delete `.next/` and restart |

## IDE Setup (VS Code)

Recommended extensions:
- ESLint
- Prettier
- TypeScript and JavaScript Language Features

Settings (`.vscode/settings.json`):
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```
