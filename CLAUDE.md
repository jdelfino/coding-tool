# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Real-time web-based coding classroom tool. Instructors create sessions with join codes, students write Python code in browsers, instructor monitors all code in real-time via WebSocket. Code executes server-side with captured output.

**Stack:** Next.js 15+ (React 19), TypeScript, Express.js 5, WebSockets, Monaco Editor

**Architecture:** Dual-server (Next.js dev on :3000, Express backend on :3001). Express handles WebSocket, Python execution, persistence, auth. Next.js proxies API calls via `next.config.js` rewrites.

## Common Commands

### Development
```bash
npm run dev          # Start dev server with hot reload (watches server changes)
npm run build        # Build Next.js frontend for production
npm start            # Start production server
npm run prod         # Build + start production (npm run build && npm start)
```

### Testing
```bash
npm test             # Run all Jest tests (server + client projects)
npm run test:watch   # Run tests in watch mode for development
npm run test:coverage # Generate coverage report (outputs to coverage/)
npx tsc --noEmit     # Type check without emitting files

# Run single test file
npm test -- path/to/test.test.ts

# Run tests matching pattern
npm test -- -t "test name pattern"

# E2E tests (Playwright)
npm run test:e2e           # Run all e2e tests
npm run test:e2e:headed    # Run with browser visible
npm run test:e2e:ui        # Interactive UI mode
npm run test:e2e:debug     # Debug mode
```

### Linting
```bash
npm run lint         # Run ESLint
```

### Data Management
```bash
npm run clear-data   # Clear all data files (users, sessions, revisions)
npm run seed-data    # Populate with test data (creates users, namespaces, sections)
```

## Key Architecture Concepts

**Repository Pattern:** All data access through interfaces in `src/server/persistence/interfaces.ts`. Current impl: local JSON files in `data/`. All repos return `Promise<T>`, throw `PersistenceError` on errors, return `null` for not-found.

**RBAC:** Roles = `system-admin`, `namespace-admin`, `instructor`, `student`. API routes use `requireAuth(permission)` middleware. WebSocket uses `hasPermission(connection, permission)`. Frontend uses `usePermissions()` hook.

**Multi-Tenancy:** `Namespace` → `Section` → `Session` hierarchy. Namespace IDs must be kebab-case. Sessions repository is REQUIRED (catastrophic failure if missing). Cross-namespace references are blocked.

**Code Execution:** `src/server/code-executor.ts` spawns Python subprocess with 10s timeout. Python 3.8+ required, stdlib only, single file per student.

**Key Files:** `src/server/websocket-handler.ts` (message routing), `src/server/session-manager.ts` (session state), `src/server/revision-buffer.ts` (diff storage saves 70% space).

## Testing Strategy

**CRITICAL RULE:** All production code changes MUST include new tests. See AGENTS.md.

### Test Organization

Jest projects (see `jest.config.js`):
1. **server** project: Node environment
   - Tests: `src/server/**/__tests__/**/*.test.ts`
   - API tests: `src/app/api/**/__tests__/**/*.test.ts`
2. **client** project: jsdom environment
   - Component tests: `src/app/**/__tests__/**/*.test.tsx`
   - Hook tests: `src/hooks/**/__tests__/**/*.test.ts`

### Test Utilities

**Server Tests:**
- `src/server/__tests__/test-utils/` - Mocks and helpers
- `uuid-mock.ts` - Predictable UUID generation
- Mock repositories for isolated testing

**API Tests:**
- `src/app/api/__tests__/test-helpers.ts` - Auth mocking utilities
- `createMockAuth()` - Mock authenticated requests
- Repository mocks available

**Key Pattern:** Use repository mocks to isolate business logic from persistence.

### Running Focused Tests

```bash
# Single file
npm test -- src/server/code-executor.test.ts

# Pattern matching
npm test -- -t "executeCode"

# Watch mode for TDD
npm run test:watch -- src/server/websocket-handler.test.ts
```

## Development Guidelines

**Type Safety:** Strict TypeScript enabled. Path alias `@/*` → `src/*`. Avoid `as any`. Run `npx tsc --noEmit` before commits.

**Dates:** Repositories auto-convert Date ↔ ISO strings. In-memory uses `Date` objects, persistence uses strings.

**Permissions:** Every privileged operation needs permission check (API: `requireAuth(permission)`, WebSocket: `hasPermission(connection, permission)`).

**Don't use optional chaining on required fields.** Trust the type system - if `user.role` is required, use `user.role` not `user?.role`.

## 🚨 CRITICAL: Beads Issue Tracking

This project uses `bd` (beads) for issue tracking. **ALWAYS use beads Skills, NEVER use Bash for bd commands.**

### ❌ WRONG - DO NOT DO THIS:
```typescript
Bash("bd list --status=open --json")
Bash("bd show ct-123 --json")
Bash("bd close ct-123 --reason 'Done'")
```

### ✅ CORRECT - USE SKILLS:
```typescript
Skill(skill: "beads:list", args: "--status=open")
Skill(skill: "beads:show", args: "ct-123")
Skill(skill: "beads:close", args: "ct-123 --reason 'Done'")
Skill(skill: "beads:sync")
```

**Available beads skills:** `beads:list`, `beads:show`, `beads:create`, `beads:update`, `beads:close`, `beads:sync`, `beads:search`, `beads:ready`, `beads:dep`, `beads:label`, `beads:epic`, and more. Check skill list before running any `bd` command.

**Always commit `.beads/issues.jsonl` with related code changes.**

See AGENTS.md for complete beads workflow details.

## Additional Resources

- **README.md** - User guide and full architecture
- **AGENTS.md** - AI workflows, test-first development, beads workflow
- **DESIGN_NOTES.md** - Design vision and roadmap
