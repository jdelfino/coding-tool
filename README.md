# Live Coding Classroom

A real-time web-based coding tool designed for classroom instruction. Instructors can create coding sessions, display problems, and monitor student progress in real-time. Students can write and execute Python code directly in their browsers.

## Features

- **Session Management**: Create coding sessions with unique join codes
- **Real-time Synchronization**: Live code updates from students to instructor
- **Code Execution**: Server-side Python execution with output capture
- **Instructor Dashboard**: Monitor all connected students and view their code
- **Student Interface**: Browser-based code editor with syntax highlighting
- **No Installation Required**: Students only need a web browser

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
python3 --version
```

## Running Locally

Start the development server:

```bash
npm run dev
```

The application will be available at:
- Main page: http://localhost:3000
- Instructor dashboard: http://localhost:3000/instructor
- Student interface: http://localhost:3000/student

## Usage

### For Instructors

1. Navigate to http://localhost:3000
2. Click "I'm an Instructor"
3. Click "Create Session" to generate a join code
4. Share the join code with students (visible on screen)
5. Enter a problem statement for students to solve
6. Click "Update Problem" to send it to all students
7. Monitor connected students in the student list
8. Click "View Code" on any student to see their code
9. Click "Run Code" to execute and see results

### For Students

1. Navigate to http://localhost:3000
2. Click "I'm a Student"
3. Enter your name and the join code provided by the instructor
4. Click "Join Session"
5. Read the problem statement
6. Write your code in the editor
7. Click "Run Code" to execute and see output
8. Your code automatically syncs with the instructor's view

## Architecture

### Technology Stack

- **Frontend**: Next.js 14 (React), TypeScript
- **Backend**: Express.js, WebSockets (ws)
- **Code Editor**: Monaco Editor
- **Syntax Highlighting**: react-syntax-highlighter
- **Code Execution**: Python 3 (child_process)

### Project Structure

```
├── src/
│   ├── app/                    # Next.js app directory
│   │   ├── instructor/        # Instructor dashboard
│   │   │   └── components/    # Instructor UI components
│   │   ├── student/           # Student interface
│   │   │   └── components/    # Student UI components
│   │   ├── layout.tsx         # Root layout
│   │   └── page.tsx           # Landing page
│   ├── hooks/                 # React hooks
│   │   └── useWebSocket.ts    # WebSocket connection hook
│   └── server/                # Backend server
│       ├── index.ts           # Express + WebSocket server
│       ├── session-manager.ts # Session management
│       ├── code-executor.ts   # Python execution
│       ├── websocket-handler.ts # WebSocket message routing
│       └── types.ts           # TypeScript interfaces
├── package.json
├── tsconfig.json
└── next.config.js
```

### Communication Flow

1. **WebSocket Connection**: Both instructor and students connect via WebSocket on `/ws`
2. **Session Creation**: Instructor creates session, receives unique join code
3. **Student Join**: Students join using join code, WebSocket connection established
4. **Code Sync**: Student code changes sent to server, broadcast to instructor
5. **Code Execution**: Python code executed in isolated child process, results returned
6. **Problem Updates**: Instructor updates problem, broadcast to all students

## Known Limitations (Phase 1)

- In-memory session storage (sessions lost on server restart)
- No persistent code history
- No authentication or user accounts
- Basic sandboxing only (timeout-based)
- Single file per student
- No third-party Python package support
- No collaborative editing

## Future Phases

See [DESIGN_NOTES.md](DESIGN_NOTES.md) for planned features:
- Persistent storage with revision history
- Pre-defined problem repository
- Test case support
- Integrated debugger
- AI-powered error analysis
- Advanced code sandboxing

## Development

### Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production
- `npm start` - Start production server
- `npm run lint` - Run ESLint

### Adding Features

1. Backend changes go in `src/server/`
2. Frontend components in `src/app/[role]/components/`
3. Shared hooks in `src/hooks/`
4. Update types in `src/server/types.ts`

## License

ISC

## Contributing

This is an educational project. Contributions welcome via pull requests.
