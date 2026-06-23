# Live Coding Classroom

A real-time web-based coding tool for classroom instruction. Instructors create classes and sections, students join via codes, and everyone participates in live coding sessions with real-time synchronization.

## Key Features

- **Class & Section Management** - Organize courses with multiple sections (by semester, time slot)
- **Live Coding Sessions** - Real-time code sync via Supabase Realtime
- **Code Execution** - Server-side Python execution with output capture
- **Monaco Editor** - VS Code-powered editor with syntax highlighting
- **AI Walkthrough** - Gemini-powered analysis of student submissions
- **Problem Library** - Reusable problems with starter code
- **Multi-Tenancy** - Namespace isolation with RBAC

## Tech Stack

- **Frontend**: Next.js 16, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API routes, Supabase (PostgreSQL + Auth + Realtime)
- **Editor**: Monaco Editor
- **Code Execution**: Local nsjail sandbox (Python 3)
- **Testing**: Jest, Playwright (E2E)

## Quick Start

### Devcontainer (recommended for the classroom)

Open the repo in a Dev Container (VS Code "Reopen in Container", or `devpod up`).
First boot installs all tooling, starts local Supabase, and writes `.env.local`
automatically — **no external accounts or secrets required**. The app is served
with `npm run dev`. The only manual step (and only if you'll open a pull request)
is authenticating GitHub with your own account:

```bash
gh auth login   # use your own GitHub account; fork or "Use this template" first
```

See [docs/DEVCONTAINER.md](docs/DEVCONTAINER.md) for details.

### Manual (run directly on your machine)

```bash
# 1. Clone and install
git clone https://github.com/jdelfino/coding-tool.git
cd coding-tool
npm install

# 2. Start local Supabase
npx supabase start

# 3. Configure environment (copy keys from supabase start output)
cp .env.example .env.local
# Edit .env.local with your Supabase keys

# 4. Reset database with seed data
npx supabase db reset

# 5. Start dev server
npm run dev
```

**Access the app:**
- App: http://localhost:3000
- Supabase Studio: http://localhost:54323
- Test login: `admin@test.local` / `password123`

## Environment Variables

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase API URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase publishable key (safe for browser) |
| `SUPABASE_SECRET_KEY` | Supabase secret key (server-only) |
| `SYSTEM_ADMIN_EMAIL` | Email auto-promoted to system-admin |
| `GEMINI_API_KEY` | (Optional) For AI Walkthrough feature |

## Development

```bash
npm run dev           # Start dev server
npm test              # Run all tests
npm run test:e2e      # Run Playwright E2E tests
npm run lint          # Run ESLint
npx tsc --noEmit      # Type check
```

## AI Agent Workflow

This repo is built to be developed with [Claude Code](https://claude.com/claude-code). Implementation work is driven through slash commands rather than by hand:

| Command | Purpose |
|---------|---------|
| `/plan <description-or-epic-id>` | Explore the codebase, weigh tradeoffs, file issues, and run a plan review. Use before `/work` for new epics. |
| `/work <id-or-description>` | The single entry point for implementation — triages the work, creates a branch/PR, manages issues, and runs specialized reviews. |
| `/merge` | Process open PRs: merge when CI passes, handle rebases, file issues for failures. Run in a dedicated window. |

Issue tracking uses **bd (beads)**. See [CLAUDE.md](CLAUDE.md) for the conventions Claude follows when working in this repo.

## Architecture Overview

```
Namespace (organization)
└── Class (e.g., CS 101)
    └── Section (e.g., Fall 2025 Section A)
        ├── Instructors
        ├── Students (join via code)
        └── Sessions (live coding)
```

**Roles**: `system-admin` → `namespace-admin` → `instructor` → `student`

**Data Flow**: Student types → Supabase Realtime → Instructor dashboard

## Code Execution Architecture

Python code runs in a local sandbox via a pluggable backend registry
(`src/server/code-execution/`). The local backend is the only execution
backend:

| Backend | When used | Description |
|---------|-----------|-------------|
| `local-python` | default | Runs Python in an **nsjail** sandbox (Linux namespace isolation) |
| `disabled` | fallback | Used when execution is unavailable; returns a clear error |

Tests run with `DISABLE_SANDBOX=true` so they don't require nsjail.

**Design notes:**
- Backends register at module load and are chosen by `BackendRegistry` in an
  explicit selection order (`local-python` → `disabled`).
- The registry/executor keep generic session lifecycle hooks (`warmup`/`cleanup`)
  for any future session-scoped backend (e.g. a container backend); the local
  backend is stateless, so they are no-ops today.
- Code never runs unsandboxed: a failure to sandbox returns an error rather than
  executing.

## Project Structure

```
src/
├── app/                    # Next.js pages and API routes
│   ├── api/               # REST API endpoints
│   ├── instructor/        # Instructor dashboard
│   ├── student/           # Student interface
│   └── admin/             # Admin panels
├── server/                # Backend logic
│   ├── persistence/       # Supabase repositories
│   ├── auth/             # Authentication & RBAC
│   └── services/         # Business logic
└── hooks/                 # React hooks
```

## Documentation

- **[User Guide](docs/USER_GUIDE.md)** - End-user documentation
- **[Setup Guide](docs/SETUP.md)** - Detailed setup instructions
- **[Authentication](docs/AUTHENTICATION.md)** - Auth system details
- **[CLAUDE.md](CLAUDE.md)** - Guidance Claude Code loads when working in this repo

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Run `npm test && npm run lint && npx tsc --noEmit`
5. Submit a Pull Request

## License

ISC License - see [LICENSE](LICENSE)
