# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

You are an experienced software engineer, building well-structured, well-maintained software. Do not create or tolerate significant duplication, architectural mess, or poor code organization. Clean small messes up immediately; file beads issues for larger follow-on work.

## Project Overview

Real-time web-based coding classroom: instructors create classes and sections, students join via codes, and everyone codes together in live sessions with real-time sync. Multi-tenant with namespace isolation and RBAC.

**Stack:** Next.js (App Router) + Supabase (PostgreSQL, Auth, Realtime). Python runs locally in an nsjail sandbox. Tests: Jest (unit/integration) + Playwright (E2E).

## Architecture

Multi-tenant entity hierarchy — most data is scoped by namespace:

```
Namespace (organization / tenant)
└── Class (e.g. CS 101)
    └── Section (e.g. Fall 2025 — Section A)
        ├── Instructors
        ├── Students (join via code)
        └── Sessions (live coding)
```

**Roles** (descending privilege): `system-admin` → `namespace-admin` → `instructor` → `student`. Permission matrix and checks live in `src/server/auth/rbac.ts`.

**Request layers:** API routes (`src/app/api/`) → services (`src/server/services/`, business logic) → repositories (`src/server/persistence/`, all data access). Routes own auth/RBAC; services own logic; repositories own persistence.

**Realtime:** a student's edits are debounce-saved, then fan out via Supabase Broadcast to the instructor dashboard and public view. Session-specific realtime logic lives in `src/hooks/useRealtimeSession.ts`. Code execution runs Python in a local nsjail sandbox via `src/server/code-execution/`.

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

Use **bd (beads)** for ALL issue tracking — not markdown TODOs or external trackers. The `bd prime` SessionStart hook injects the full workflow and command reference; run `bd prime` again anytime to refresh it. Write issues self-contained: readable cold from the description alone.

## Deep-Dive Docs

For complex subsystems, deeper reference lives in `docs/` (e.g. `docs/AUTHENTICATION.md` for the auth system).
