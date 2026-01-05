# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a real-time web-based coding classroom tool. Instructors create sessions with join codes, students write Python code in their browsers, and the instructor can monitor all students' code in real-time via WebSocket. Code executes server-side with captured output.

**Core Stack:** Next.js 15+ (React 19), TypeScript, Express.js 5, WebSockets (ws), Monaco Editor

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

## Architecture Overview

### Dual Server Architecture

**Critical:** This project runs TWO servers in one process:
1. **Next.js dev server** (port 3000) - Frontend React app
2. **Express server** (port 3001) - WebSocket + API backend

The Express server (`src/server/index.ts`) handles:
- WebSocket connections for real-time code sync
- Server-side Python code execution
- Session management and persistence
- Authentication middleware

Next.js frontend proxies API calls to Express via `rewrites` in `next.config.js`.

### Repository Pattern for Persistence

All data access goes through repository interfaces (`src/server/persistence/interfaces.ts`):
- `ISessionRepository` - Session CRUD
- `IProblemRepository` - Problem library
- `IRevisionRepository` - Code revision history
- `IUserRepository` - User accounts (in `src/server/auth/interfaces.ts`)
- `INamespaceRepository` - Multi-tenant namespaces
- `ISectionRepository` - Class sections
- `IMembershipRepository` - Section memberships

Current implementation: Local file-based JSON storage (`src/server/persistence/local/`)
- Data stored in `data/` directory (gitignored)
- Uses atomic writes with temp files
- Date serialization/deserialization handled automatically

**Key Pattern:** All repositories return `Promise<T>`, throw `PersistenceError` for errors, return `null` for not-found.

### WebSocket Message Flow

1. Client connects → `WebSocketHandler` extracts user from cookie
2. Student sends `JOIN_SESSION` → Server validates session, adds to participants
3. Student types code → `CODE_UPDATE` → Server stores diff via `RevisionBuffer`
4. Instructor requests code → `REQUEST_STUDENT_CODE` → Server broadcasts student's code
5. Code execution → `EXECUTE_CODE` → Spawns Python subprocess, returns output

**Critical Files:**
- `src/server/websocket-handler.ts` (1024 lines) - Message routing, permission checks
- `src/server/session-manager.ts` (658 lines) - Session state management
- `src/server/revision-buffer.ts` (285 lines) - Differential code storage (70% size reduction)

### RBAC (Role-Based Access Control)

Authentication flow:
1. User signs in via `/api/auth/signin`
2. Server creates session, sets HTTP-only `sessionId` cookie
3. Cookie validated on API routes via `requireAuth` middleware
4. WebSocket connections extract user from cookie

**Roles:** `superadmin`, `admin`, `instructor`, `student`

**Permission Enforcement:**
- API routes: Use `requireAuth(permission)` middleware
- WebSocket: `hasPermission(connection, permission)` checks in handlers
- Frontend: `usePermissions()` hook for UI visibility

**Key Files:**
- `src/server/auth/rbac.ts` - Permission checking logic
- `src/server/auth/permissions.ts` - Permission definitions
- `src/server/auth/middleware.ts` - Express middleware wrappers

### Multi-Tenancy

**Namespace Hierarchy:** `Namespace` → `Section` → `Session`

- **Namespace**: Top-level tenant (e.g., "CS Department")
- **Section**: Class instance (e.g., "CS101 Fall 2024")
- **Session**: Single coding session within a section

**Validation:** Namespace IDs must match `/^[a-z0-9]+(-[a-z0-9]+)*$/` (kebab-case)

Users belong to namespaces with role mappings. Sessions always belong to a section.

### Code Execution Sandbox

`src/server/code-executor.ts`:
- Spawns isolated Python child process
- 10-second timeout enforced
- Captures stdout/stderr
- Execution settings: stdin, randomSeed, attachedFiles
- **No package installation support** (by design for Phase 1)

**Security:** Basic timeout-based sandboxing. NOT production-ready for untrusted environments.

### Revision History with Differential Storage

`RevisionBuffer` batches code changes and stores diffs (not full snapshots):
- Every 10th revision: full snapshot
- Other revisions: diff from previous
- Server-side diff generation using `diff-match-patch`
- Smart flushing: debounced writes (5s delay) + max buffer size

**Why:** Reduces storage by ~70% for code revision history.

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

## Important Development Patterns

### Type Safety

- **Strict TypeScript enabled** in `tsconfig.json`
- Path alias: `@/*` maps to `src/*`
- Avoid `as any` or `as unknown` - use proper interfaces
- Run `npx tsc --noEmit` before commits

### Date Handling

- In-memory: Use `Date` objects
- Persistence: Automatic serialization to ISO strings
- Repositories handle conversion transparently

### WebSocket Connection Lifecycle

```typescript
// Connection object stored in WebSocketHandler
interface Connection {
  ws: WebSocket;
  role: 'instructor' | 'student' | 'public';
  sessionId?: string;
  studentId?: string;
  userId?: string;      // From auth cookie
  user?: User;          // Full user for RBAC
  isAlive: boolean;     // Heartbeat tracking
}
```

Heartbeat runs every 30s to detect dead connections.

### Session Lifecycle

1. Instructor creates session → Persisted with `status: 'active'`
2. Students join → Added to `session.students` Map
3. Instructor ends session → `status: 'completed'`, `endedAt` set
4. History queries filter by `status` and date ranges

### Problem Library

Problems stored separately from sessions:
- `Problem` type: title, description, starterCode, executionSettings, metadata
- Stored in `data/problems.json`
- Can be loaded into sessions via `/api/sessions/:id/load-problem`

**Metadata:** tags, difficulty, language, author, category for future filtering

## File Organization

```
src/
├── app/                    # Next.js app (frontend)
│   ├── admin/             # Admin user management UI
│   ├── auth/              # Sign in/out pages
│   ├── instructor/        # Instructor dashboard + components
│   ├── student/           # Student interface + components
│   ├── api/               # API routes (proxy to Express)
│   └── layout.tsx         # Root layout with AuthContext
├── components/            # Shared React components
├── contexts/              # React contexts (AuthContext)
├── hooks/                 # Custom hooks (useWebSocket, usePermissions)
└── server/                # Express backend
    ├── index.ts           # Server entry point
    ├── websocket-handler.ts  # WS message routing (largest file)
    ├── session-manager.ts    # Session state management
    ├── revision-buffer.ts    # Code diff storage
    ├── code-executor.ts      # Python execution
    ├── code-tracer.ts        # Debugger trace generation
    ├── types.ts              # Core type definitions
    ├── auth/                 # Authentication + RBAC
    │   ├── rbac.ts
    │   ├── permissions.ts
    │   ├── middleware.ts
    │   ├── local-provider.ts
    │   └── interfaces.ts
    ├── persistence/          # Data layer
    │   ├── interfaces.ts     # Repository contracts
    │   ├── types.ts          # Persistence types
    │   └── local/            # File-based implementations
    └── __tests__/            # Server tests
```

## Avoiding Common Pitfalls

### Don't Use Optional Chaining on Required Fields

```typescript
// BAD: role is always present on User
const role = user?.role;

// GOOD: Trust the type system
const role = user.role;
```

### Don't Skip Permission Checks

Every privileged operation needs a permission check:
```typescript
// API route
export const POST = requireAuth('sessions:create')(async (req, context) => {
  // handler logic
});

// WebSocket
if (!this.hasPermission(connection, 'sessions:end')) {
  ws.send(JSON.stringify({ error: 'Permission denied' }));
  return;
}
```

### Don't Forget Date Conversions

When reading from storage, dates come back as ISO strings. Repositories handle this, but be aware:
```typescript
const session = await sessionRepo.getSession(id);
// session.createdAt is already a Date object (repo converted it)
```

### Don't Mix Session and Student Execution Settings

Use `getEffectiveExecutionSettings()` pattern:
```typescript
const effectiveSettings = {
  stdin: student.executionSettings?.stdin ?? session.problem.executionSettings?.stdin,
  // ... other settings
};
```

Student settings override session settings.

## Critical Constraints

1. **Python 3.8+ required** - Code execution depends on it
2. **No third-party packages** - Only stdlib (by design for Phase 1)
3. **Single file per student** - No multi-file projects
4. **Timeout: 10 seconds** - Hard limit on code execution
5. **Local storage only** - No database in current implementation
6. **Namespace ID format** - Must be kebab-case (`^[a-z0-9]+(-[a-z0-9]+)*$`)

## Beads Issue Tracking

This project uses `bd` (beads) for issue tracking. See AGENTS.md for workflow details.

**Key Commands:**
```bash
bd ready --json           # Show ready-to-work issues
bd create "Title" -p 1    # Create issue (priority 1)
bd update bd-42 --status in_progress
bd close bd-42 --reason "Done"
bd sync                   # Sync with git (auto-debounced)
```

**Always commit `.beads/issues.jsonl` with related code changes.**

## Production Deployment Notes

**⚠️ Current security is NOT production-ready:**
- Simple username auth (no passwords)
- Basic timeout sandboxing (needs containers)
- Local file storage (consider database)
- No rate limiting

See README.md "Security Considerations" section before deploying.

## Debugging Tips

### Server Logs
Development mode (`npm run dev`) includes verbose logging. Check terminal output.

### WebSocket Issues
- Check browser console for WS connection errors
- Verify cookies are set (`sessionId`)
- Check server logs for authentication failures

### Data Issues
```bash
# Inspect data files
cat data/users.json | jq .
cat data/sessions.json | jq .

# Clear and reseed
npm run clear-data
npm run seed-data
```

### Type Errors
```bash
# Full type check
npx tsc --noEmit

# Check specific file
npx tsc --noEmit src/server/websocket-handler.ts
```

## Additional Documentation

- **README.md** - Comprehensive user guide and architecture
- **AGENTS.md** - AI agent workflows and test-first development rules
- **DESIGN_NOTES.md** - Original design vision and roadmap
- **docs/SETUP.md** - Detailed setup instructions
- **docs/USER_GUIDE.md** - End-user documentation
