# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

See [README.md](README.md) for full project description, tech stack, architecture, and setup instructions.

**Quick context:** Real-time coding classroom tool. Next.js + Supabase (PostgreSQL, Auth, Realtime). Python execution via Vercel Sandbox (prod) or nsjail (dev).

## Key Files for Navigation

- `src/hooks/useRealtime.ts` - Supabase Realtime subscriptions
- `src/hooks/useRealtimeSession.ts` - Session-specific realtime logic
- `src/server/persistence/` - Supabase repositories (all data access)
- `src/server/auth/rbac.ts` - Permission matrix and RBAC logic
- `src/server/services/` - Business logic layer

## Commands

```bash
# Development
npm run dev              # Start dev server
npm run seed-data        # Reset DB with seed data (runs supabase db reset)

# Testing
npm test                 # Run all Jest tests
npm test -- path/to/test # Single file
npm test -- -t "pattern" # Pattern matching
npm run test:watch       # Watch mode for TDD
npm run test:e2e         # Playwright E2E tests (requires Supabase running)

# Quality
npm run lint             # ESLint
npx tsc --noEmit         # Type check
```

### Running E2E Tests Locally

```bash
npx supabase start           # 1. Start local Supabase
source .env.local            # 2. Load environment variables
npx playwright install chromium  # 3. First time only
npm run test:e2e             # 4. Run tests
```

E2E tests skip automatically if `SUPABASE_SECRET_KEY` is not set.

## Testing Rules

**All production code changes MUST include tests.** See AGENTS.md for workflow details.

**NEVER debug E2E tests by pushing to CI.** Always run `npm run test:e2e` locally first. Waiting for remote CI is slow and wasteful.

### Test Organization

Jest projects (see `jest.config.js`):
- **server**: `src/server/**/__tests__/**/*.test.ts`, `src/app/api/**/__tests__/**/*.test.ts`
- **client**: `src/app/**/__tests__/**/*.test.tsx`, `src/hooks/**/__tests__/**/*.test.ts`

### Test Utilities

- `src/server/__tests__/test-utils/` - Server mocks and helpers
- `src/app/api/__tests__/test-helpers.ts` - `createMockAuth()` and API test utilities
- Use repository mocks to isolate business logic from persistence

## Development Guidelines

**Type Safety:** Strict TypeScript. Path alias `@/*` → `src/*`. Avoid `as any`. Run `npx tsc --noEmit` before commits.

**Dates:** Repositories auto-convert Date ↔ ISO strings. In-memory uses `Date` objects, persistence uses strings.

**Permissions:** Use `getAuthContext()` in API routes for auth + RBAC checks.

**Repository Pattern:** All data access through `src/server/persistence/interfaces.ts`. Repos return `Promise<T>`, throw `PersistenceError` on errors, return `null` for not-found.

**Don't use optional chaining on required fields.** Trust the type system - if `user.role` is required, use `user.role` not `user?.role`.

## Issue Tracking (beads)

This project uses `bd` (beads) for issue tracking. Key commands:

```bash
bd show <id> --json      # View issue details
bd list --json           # List issues
bd ready --json          # Show unblocked issues
bd update <id> --status in_progress --json
bd close <id> --reason "Done" --json
bd create "Title" -t task -p 2 --json
bd dep add <blocked> <blocker> --json  # Add dependency
```

See AGENTS.md for full beads documentation.

## Additional Resources

- **[README.md](README.md)** - Project overview, setup, architecture
- **[AGENTS.md](AGENTS.md)** - AI workflows, test-first development, beads issue tracking
