# Live Coding Classroom

A real-time web-based coding tool designed for classroom instruction. Instructors can create coding sessions, display problems, and monitor student progress in real-time. Students can write and execute Python code directly in their browsers.

## Features

### Core Functionality
- **Session Management**: Create coding sessions with unique 6-character join codes
- **Real-time Synchronization**: Live code updates from students to instructor via WebSocket
- **Code Execution**: Server-side Python execution with output capture and error handling
- **Instructor Dashboard**: Monitor all connected students and view their code in real-time
- **Student Interface**: Monaco-based code editor (same as VS Code) with Python syntax highlighting
- **No Installation Required**: Students only need a web browser

### Authentication & Authorization
- **Role-Based Access Control (RBAC)**: Separate instructor and student roles with fine-grained permissions
- **User Management**: Admin interface for managing instructors and students
- **Secure Sessions**: Cookie-based authentication with session management
- **Auto-Account Creation**: First user becomes instructor, subsequent users are students (local mode)

### Persistence & History
- **File-Based Storage**: Sessions, problems, revisions, and users persisted to JSON files
- **Revision Tracking**: Complete code history with differential storage for efficiency
- **Session History**: View past sessions and their associated data
- **Smart Buffering**: Server-side diff generation with batched persistence (reduces storage by ~70%)

### Advanced Features
- **Public Session View**: Share read-only session views for classroom displays
- **Revision Snapshots**: Periodic full snapshots mixed with diffs for reliability
- **Admin Panel**: User management interface for instructors
- **Multiple Sessions**: Support for concurrent coding sessions

## Requirements

- **Node.js**: v18 or higher
- **Python**: v3.8 or higher
- **npm**: v9 or higher

## Installation

1. Clone the repository:
```bash
git clone https://github.com/jdelfino/coding-tool.git
cd coding-tool
```

2. Install dependencies:
```bash
npm install
```

3. Verify Python is installed:
```bash
python3 --version  # Should be 3.8 or higher
```

4. Initialize data directory (automatic on first run):
   - The `data/` directory is created automatically
   - Contains JSON files for persistent storage
   - Includes: `users.json`, `sessions.json`, `revisions.json`, `problems.json`, `auth-sessions.json`

## Running Locally

### Development Mode

Start the development server with hot reload:

```bash
npm run dev
```

The application will be available at http://localhost:3000

### Production Mode

Build and run in production:

```bash
npm run build
npm start
```

## Usage

### First Time Setup

1. Navigate to http://localhost:3000
2. You'll be redirected to the sign-in page
3. Enter a username to create your account
   - **First user** automatically becomes an instructor
   - **Subsequent users** become students by default
4. You'll be redirected based on your role

### For Instructors

1. **Access Instructor Dashboard**
   - Sign in at http://localhost:3000 (automatic redirect if already authenticated)
   - Instructor dashboard loads automatically

2. **Create a Session**
   - Click "Create Session" to generate a unique 6-character join code
   - The join code is displayed prominently on screen

3. **Set a Problem**
   - Enter a problem statement in the "Problem Statement" field
   - Click "Update Problem" to broadcast it to all students
   - Students see the problem update in real-time

4. **Monitor Students**
   - View list of all connected students
   - See indicators showing which students have written code (✓ = has code, ○ = no code)
   - Click "View Code" on any student to see their current code
   - Click "Run Code" to execute student code and see results

5. **Session History**
   - Access past sessions through the history interface
   - View complete revision history for any student

6. **User Management (Admin)**
   - Navigate to `/admin` to manage users
   - Add additional instructors
   - View and manage all user accounts

### For Students

1. **Sign In**
   - Navigate to http://localhost:3000
   - Enter your username (creates account if first time)
   - Note: Students must be created by an instructor or auto-created on first sign-in

2. **Join a Session**
   - Enter your display name
   - Enter the 6-character join code provided by your instructor
   - Click "Join Session"

3. **Complete the Assignment**
   - Read the problem statement at the top of the page
   - Write your Python code in the Monaco editor
   - Click "Run Code" to execute and see output
   - Your code auto-saves and syncs with the instructor's view in real-time

4. **View Results**
   - Standard output appears in the output panel
   - Errors are displayed with helpful messages
   - Execution time is shown for performance awareness

## Architecture

### Technology Stack

- **Frontend**: Next.js 15+ (React 19), TypeScript
- **Backend**: Express.js 5, WebSockets (ws)
- **Code Editor**: Monaco Editor (VS Code engine)
- **Code Execution**: Python 3 (child_process with timeout protection)
- **Authentication**: Cookie-based sessions with RBAC
- **Storage**: File-based JSON persistence with repository pattern
- **Testing**: Jest with comprehensive test coverage

### Project Structure

```
├── src/
│   ├── app/                     # Next.js app directory (frontend)
│   │   ├── admin/              # Admin user management UI
│   │   ├── auth/               # Authentication pages (sign in/out)
│   │   ├── instructor/         # Instructor dashboard and components
│   │   │   ├── components/    # SessionControls, StudentList, CodeViewer, etc.
│   │   │   └── public/        # Public session view (read-only)
│   │   ├── student/           # Student interface and components
│   │   │   └── components/    # CodeEditor, JoinForm, ProblemDisplay, etc.
│   │   ├── layout.tsx         # Root layout with AuthContext
│   │   └── page.tsx           # Landing page with role-based routing
│   ├── components/            # Shared React components
│   │   └── ProtectedRoute.tsx # Route authentication wrapper
│   ├── contexts/              # React contexts
│   │   └── AuthContext.tsx    # Authentication state management
│   ├── hooks/                 # Custom React hooks
│   │   ├── useWebSocket.ts    # WebSocket connection management
│   │   └── useSessionHistory.ts # Session history retrieval
│   └── server/                # Backend server
│       ├── index.ts           # Express + WebSocket server
│       ├── session-manager.ts # Session management with persistence
│       ├── revision-buffer.ts # Code revision tracking with diff storage
│       ├── code-executor.ts   # Python execution sandbox
│       ├── websocket-handler.ts # WebSocket message routing
│       ├── types.ts           # TypeScript interfaces
│       ├── auth/              # Authentication & authorization
│       │   ├── rbac.ts        # Role-based access control
│       │   ├── local-provider.ts # Local auth implementation
│       │   ├── middleware.ts  # Auth middleware
│       │   ├── permissions.ts # Permission definitions
│       │   └── user-repository.ts # User data access
│       └── persistence/       # Data persistence layer
│           ├── interfaces.ts  # Repository interfaces
│           ├── local/           # Local file-based storage implementations
│           │   ├── index.ts
│           │   ├── utils.ts
│           │   ├── session-repository.ts
│           │   ├── problem-repository.ts
│           │   ├── revision-repository.ts
│           │   └── user-repository.ts
│           ├── types.ts       # Persistence types
│           └── index.ts       # Storage backend integration
├── data/                      # Persistent data files (JSON)
│   ├── users.json            # User accounts
│   ├── sessions.json         # Coding sessions
│   ├── revisions.json        # Code revision history
│   ├── problems.json         # Problem library
│   └── auth-sessions.json    # Active authentication sessions
├── docs/                     # Documentation
│   ├── SETUP.md             # Setup instructions
│   └── USER_GUIDE.md        # End-user documentation
└── coverage/                # Test coverage reports
```

### Communication Flow

1. **Authentication**
   - User signs in via `/api/auth/signin`
   - Server creates session, sets HTTP-only cookie
   - Cookie validated on subsequent requests
   
2. **Session Creation**
   - Instructor creates session via WebSocket
   - Session data persisted to `data/sessions.json`
   - Join code generated and returned to instructor

3. **Student Join**
   - Student enters join code, connects via WebSocket
   - Server validates session exists
   - Student added to session participants
   - Session state broadcast to instructor

4. **Code Synchronization**
   - Student types code in Monaco editor
   - Changes sent to server via WebSocket
   - Server generates diff from previous version
   - Revision buffered in memory with smart flushing
   - Full snapshot stored periodically (every 10th revision)
   - Changes broadcast to instructor's view

5. **Code Execution**
   - Student/instructor triggers execution
   - Server spawns isolated Python child process
   - 10-second timeout enforced
   - stdout/stderr captured and returned
   - Execution time measured and reported

6. **Problem Distribution**
   - Instructor updates problem text
   - Server persists to session data
   - Problem broadcast to all connected students via WebSocket
   - Students see update in real-time

### Data Persistence

The application uses a **repository pattern** with file-based JSON storage:

- **Sessions**: Active and historical coding sessions
- **Revisions**: Code history with differential storage (70% size reduction)
- **Users**: Account data with roles and permissions
- **Problems**: Problem library (foundation for future features)
- **Auth Sessions**: Active authentication sessions

Storage automatically handles:
- Concurrent access protection
- Atomic writes with tmp files
- Date serialization/deserialization
- Directory creation

## Current Status & Roadmap

### ✅ Implemented (Phase 1-2)

- ✅ Real-time collaborative coding sessions
- ✅ WebSocket-based communication
- ✅ Server-side Python execution with sandboxing
- ✅ Monaco-based code editor
- ✅ Role-based authentication (instructor/student)
- ✅ User management with admin interface
- ✅ File-based persistence (sessions, users, revisions)
- ✅ Code revision history with differential storage
- ✅ Session history viewing
- ✅ Public read-only session views
- ✅ Comprehensive test coverage (Jest)
- ✅ RBAC with fine-grained permissions

### 🚧 Known Limitations

- Single programming language (Python only)
- Basic sandboxing (timeout-based, no containerization)
- No third-party Python package support
- Single file per student
- Local file storage only (no database option)
- No collaborative editing (by design)

### 🔮 Future Enhancements (Phase 3+)

- **Problem Repository**: Pre-defined problem library with tags and difficulty levels
- **Test Cases**: 
  - Instructor-provided test cases
  - Student-created test cases
  - Hidden test cases for assessments
  - Friendly test output and debugging
- **Debugger Integration**: PythonTutor-style step-through debugging
- **Starter Code**: Provide initial code templates for problems
- **AI Features**:
  - Error analysis and categorization
  - Process analysis (revision history review)
  - Competency assessment
- **Enhanced Security**: Container-based code execution (Docker/gVisor)
- **Multi-Language Support**: JavaScript, Java, C++, etc.
- **Assessment Mode**: 
  - Out-of-class assignments
  - Live coding exams
  - Automated grading with hidden tests
- **Package Management**: Support for pip/npm package installation

## Development

### Scripts

- `npm run dev` - Start development server with hot reload (watches server changes)
- `npm run build` - Build Next.js frontend for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint
- `npm test` - Run Jest test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Generate test coverage report

### Testing

The project includes comprehensive test coverage:

```bash
# Run all tests
npm test

# Run tests in watch mode during development
npm run test:watch

# Generate coverage report (outputs to coverage/)
npm run test:coverage
```

Test files are located in:
- `src/server/__tests__/` - Server-side tests
- `src/server/__tests__/auth/` - Authentication tests
- `src/server/__tests__/test-utils/` - Test utilities and mocks

### Adding Features

1. **Backend Changes**
   - Server logic: `src/server/`
   - API routes: `src/app/api/`
   - Add tests in `src/server/__tests__/`

2. **Frontend Components**
   - Instructor UI: `src/app/instructor/components/`
   - Student UI: `src/app/student/components/`
   - Shared components: `src/components/`

3. **Data Persistence**
   - Repository interfaces: `src/server/persistence/interfaces.ts`
   - Implementation: `src/server/persistence/local/`
   - Types: `src/server/persistence/types.ts`

4. **Authentication & Authorization**
   - RBAC logic: `src/server/auth/rbac.ts`
   - Permissions: `src/server/auth/permissions.ts`
   - Middleware: `src/server/auth/middleware.ts`

5. **Type Definitions**
   - Server types: `src/server/types.ts`
   - Auth types: `src/server/auth/types.ts`
   - Persistence types: `src/server/persistence/types.ts`

### Code Quality

- **TypeScript**: Strict type checking enabled
- **ESLint**: Configured for Next.js and TypeScript
- **Testing**: Jest with comprehensive coverage
- **Architecture**: Repository pattern with clean separation of concerns

## Security Considerations

### Current Implementation (Development Mode)

- **Authentication**: Simple username-based authentication (no passwords)
- **Session Management**: HTTP-only cookies with secure session storage
- **Code Execution**: Basic timeout-based sandboxing (10 seconds)
- **File System**: Local JSON file storage with atomic writes
- **RBAC**: Role-based permissions enforced server-side

### ⚠️ Production Deployment Recommendations

**Before deploying to production:**

1. **Authentication**: Implement proper password-based authentication or integrate with OAuth/SAML
2. **Code Sandboxing**: Use containerization (Docker) or sandboxing (gVisor) for code execution
3. **HTTPS**: Ensure all traffic is encrypted
4. **Database**: Consider migrating from file storage to a proper database
5. **Rate Limiting**: Add rate limiting to prevent abuse
6. **Input Validation**: Enhanced validation for all user inputs
7. **Secrets Management**: Use environment variables for sensitive configuration
8. **Monitoring**: Add logging and monitoring for security events

**Current security is suitable for:**
- Local development
- Trusted classroom environments on private networks
- Educational demonstrations

**NOT recommended for:**
- Public internet deployment
- Untrusted users
- Production environments without additional hardening

## Troubleshooting

### Common Issues

**Port Already in Use**
```bash
# Kill process on port 3000
lsof -ti:3000 | xargs kill -9
```

**WebSocket Connection Failed**
- Ensure server is running
- Check firewall settings
- Verify no proxy interference

**Python Execution Errors**
```bash
# Verify Python installation
which python3
python3 --version

# Test Python execution
python3 -c "print('Hello, World!')"
```

**Session Not Found**
- Check that `data/sessions.json` exists and is readable
- Verify storage initialization completed
- Check server logs for errors

**Authentication Issues**
- Clear browser cookies
- Check that `data/users.json` and `data/auth-sessions.json` exist
- Restart server to reinitialize storage

### Debugging

Enable detailed logging:
```bash
# Development mode includes verbose logging
npm run dev

# Check server logs in terminal
# Check browser console for frontend errors
```

## Contributing

Contributions are welcome! Please:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes with tests
4. Run tests and linting (`npm test && npm run lint`)
5. Commit your changes (`git commit -m 'Add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## License

This project is licensed under the ISC License - see the [LICENSE](LICENSE) file for details.

## Documentation

- **[SETUP.md](docs/SETUP.md)** - Detailed setup instructions
- **[USER_GUIDE.md](docs/USER_GUIDE.md)** - End-user documentation
- **[DESIGN_NOTES.md](DESIGN_NOTES.md)** - Architecture and design decisions
- **[AGENTS.md](AGENTS.md)** - Instructions for AI coding agents

## Acknowledgments

- Built with [Next.js](https://nextjs.org/), [Express](https://expressjs.com/), and [Monaco Editor](https://microsoft.github.io/monaco-editor/)
- Inspired by the need for better tools for teaching introductory programming
