# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

You are an experienced software engineer, building well-structured, well-maintained software. Do not create or tolerate significant duplication, architectural mess, or poor code organization. Clean small messes up immediately; file beads issues for larger follow-on work.

## Project Overview

See [README.md](README.md) for full project description, tech stack, architecture, and setup.

**Quick context:** Real-time coding classroom tool. Next.js + Supabase (PostgreSQL, Auth, Realtime). Python execution runs locally in an nsjail sandbox.

## Key Files for Navigation

- `src/hooks/useRealtimeSession.ts` - Session realtime logic (Broadcast subscriptions)
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
npm run test:e2e         # Playwright E2E tests (requires Supabase running)

# Quality
npm run lint             # ESLint (errors fail, warnings allowed)
npx tsc --noEmit         # Type check
```

### Running E2E Tests Locally

```bash
npx supabase start               # 1. Start local Supabase
source .env.local                # 2. Load environment variables
npx playwright install chromium  # 3. First time only
npm run test:e2e                 # 4. Run tests
```

E2E tests skip automatically if `SUPABASE_SECRET_KEY` is not set.

## Testing Rules

- **All production code changes MUST include tests.** When E2E uncovers a production bug, add a regression test at the narrowest feasible scope (unit > integration > e2e) that fails against the bug and passes against the fix.
- **NEVER debug E2E tests by pushing to CI.** Always run `npm run test:e2e` locally first — waiting on remote CI is slow and wasteful.

Jest projects (see `jest.config.js`):
- **server**: `src/server/**/__tests__/**/*.test.ts`, `src/app/api/**/__tests__/**/*.test.ts`
- **client**: `src/app/**/__tests__/**/*.test.tsx`, `src/hooks/**/__tests__/**/*.test.ts`

Test utilities: `src/server/__tests__/test-utils/` (server mocks/helpers), `src/app/api/__tests__/test-helpers.ts` (`createMockAuth()`). Use repository mocks to isolate business logic from persistence.

## Development Guidelines

- **Type Safety:** Strict TypeScript. Path alias `@/*` → `src/*`. Avoid `as any`. Run `npx tsc --noEmit` before commits.
- **Dates:** Repositories auto-convert Date ↔ ISO strings. In-memory uses `Date` objects, persistence uses strings.
- **Permissions:** Use `getAuthContext()` in API routes for auth + RBAC checks.
- **Repository Pattern:** All data access through `src/server/persistence/interfaces.ts`. Repos return `Promise<T>`, throw `PersistenceError` on errors, return `null` for not-found.
- **Don't use optional chaining on required fields.** Trust the types — if `user.role` is required, use `user.role` not `user?.role`.
- **AI planning docs** (PLAN.md, DESIGN.md, etc.): store in `history/` at the repo root. Keep the root clean.

## Issue Tracking (beads)

This project uses **bd (beads)** for ALL issue tracking — not markdown TODOs or external trackers. The command reference is injected at session start by `bd prime` (SessionStart hook); run `bd prime` yourself if you need it again, or `bd <cmd> --help` for flags. Only the project-specific judgment that `bd prime` doesn't cover lives here:

- **Self-contained issues:** every issue must be readable cold from its description alone — 1-2 sentence summary (what + why), exact file paths, numbered steps, before→after example when applicable.
- **Dependency direction:** `bd dep add X Y` means "X needs Y" (Y blocks X). Temporal words ("Phase 1", "before") invert your thinking — verify with `bd blocked`.

## Additional Resources

- **[README.md](README.md)** - Project overview, setup, architecture
- **[docs/AUTHENTICATION.md](docs/AUTHENTICATION.md)** - Auth system details
