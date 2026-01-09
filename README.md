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
- **Code Execution**: Python 3.8+ subprocess with timeout
- **Testing**: Jest, Playwright (E2E)

## Quick Start

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
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon/publishable key |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key |
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
- **[CLAUDE.md](CLAUDE.md)** - AI agent instructions
- **[AGENTS.md](AGENTS.md)** - Development workflows

## Contributing

1. Fork the repository
2. Create a feature branch
3. Write tests for your changes
4. Run `npm test && npm run lint && npx tsc --noEmit`
5. Submit a Pull Request

## License

ISC License - see [LICENSE](LICENSE)
