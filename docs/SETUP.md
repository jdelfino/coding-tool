# Development Setup Guide

## Prerequisites

Before you begin, ensure you have the following installed:

### Required Software

1. **Node.js** (v18 or higher)
   - Download from https://nodejs.org/
   - Verify installation: `node --version`
   - Should output v18.x.x or higher

2. **npm** (v9 or higher)
   - Comes with Node.js
   - Verify installation: `npm --version`
   - Should output 9.x.x or higher

3. **Python 3** (v3.8 or higher)
   - Download from https://python.org/
   - Verify installation: `python3 --version`
   - Should output Python 3.8.x or higher
   - **Important**: Python must be accessible as `python3` command

4. **Git**
   - Download from https://git-scm.com/
   - Verify installation: `git --version`

### Recommended Software

- **VS Code** - Recommended IDE with TypeScript support
- **Chrome/Firefox** - Modern browser for testing

## Initial Setup

### 1. Clone the Repository

```bash
git clone https://github.com/jdelfino/coding-tool.git
cd coding-tool
```

### 2. Install Dependencies

```bash
npm install
```

This will install all required packages including:
- Next.js and React
- Express and WebSocket libraries
- TypeScript and type definitions
- Monaco Editor
- Development tools (nodemon, tsx)

### 3. Verify Python

The application executes student code using Python. Verify it's accessible:

```bash
python3 --version
```

If this command fails, you may need to:
- Install Python 3
- Add Python to your PATH
- Create a symlink: `ln -s python python3` (Linux/Mac)

## Running the Application

### Development Mode

```bash
npm run dev
```

This starts:
- Next.js development server with hot reload
- Express backend server
- WebSocket server
- All running on http://localhost:3000

The server watches for changes in `src/server/` and automatically restarts.

### Production Build

```bash
npm run build
npm start
```

This creates an optimized production build and starts the server.

## Development Workflow

### Project Structure

```
coding-tool/
├── src/
│   ├── app/                   # Next.js frontend
│   │   ├── instructor/       # Instructor pages
│   │   ├── student/          # Student pages
│   │   ├── layout.tsx        # Root layout
│   │   └── page.tsx          # Landing page
│   ├── hooks/                # React hooks
│   └── server/               # Backend
│       ├── index.ts          # Main server
│       ├── session-manager.ts # Session logic
│       ├── code-executor.ts  # Python execution
│       ├── websocket-handler.ts # WebSocket routing
│       └── types.ts          # TypeScript types
├── docs/                     # Documentation
├── package.json              # Dependencies
├── tsconfig.json            # TypeScript config
└── next.config.js           # Next.js config
```

### Making Changes

#### Backend Changes

1. Edit files in `src/server/`
2. Server auto-restarts via nodemon
3. Test WebSocket connections

#### Frontend Changes

1. Edit files in `src/app/`
2. Next.js hot-reloads automatically
3. Check browser console for errors

#### Type Changes

1. Update `src/server/types.ts`
2. Update both frontend and backend code
3. TypeScript will catch type errors

### Testing Locally

1. **Open Multiple Browser Windows**
   - One for instructor (http://localhost:3000/instructor)
   - Multiple for students (http://localhost:3000/student)

2. **Create a Session**
   - In instructor window, click "Create Session"
   - Note the join code

3. **Join as Students**
   - In student windows, enter different names
   - Use the join code
   - Verify connection

4. **Test Features**
   - Update problem from instructor
   - Write code as students
   - Run code and check output
   - View student code from instructor

## Common Development Tasks

### Adding a New WebSocket Message Type

1. Add to `MessageType` enum in `src/server/types.ts`
2. Handle in `src/server/websocket-handler.ts`
3. Send from frontend components
4. Handle response in `useWebSocket` hook

### Adding a New UI Component

1. Create component file in appropriate directory
2. Import and use in page component
3. Add TypeScript types for props
4. Test in multiple browsers

### Debugging

#### Backend Debugging

- Check server console output
- Add `console.log()` statements
- Use Node.js debugger with `--inspect` flag

#### Frontend Debugging

- Open browser DevTools (F12)
- Check Console tab for errors
- Use React DevTools extension
- Check Network tab for WebSocket messages

#### WebSocket Debugging

- Use browser Network tab
- Filter for WS (WebSocket) connections
- Inspect messages sent/received
- Check connection status

## Environment Variables

Create a `.env.local` file for local configuration:

```bash
PORT=3000
NODE_ENV=development
```

## Known Development Issues

### Port Already in Use

If port 3000 is taken:
```bash
PORT=3001 npm run dev
```

### Python Not Found

Ensure Python 3 is in PATH:
```bash
which python3  # Linux/Mac
where python3  # Windows
```

### WebSocket Connection Failed

- Check firewall settings
- Ensure server is running
- Check browser console for errors
- Try different browser

### Hot Reload Not Working

- Restart dev server
- Clear Next.js cache: `rm -rf .next`
- Check file watchers limit (Linux)

## IDE Setup (VS Code)

### Recommended Extensions

- ESLint
- Prettier
- TypeScript and JavaScript Language Features
- Python (for testing student code)

### VS Code Settings

Add to `.vscode/settings.json`:
```json
{
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": true
  },
  "typescript.tsdk": "node_modules/typescript/lib"
}
```

## Getting Help

- Check [README.md](../README.md) for overview
- See [USER_GUIDE.md](USER_GUIDE.md) for usage instructions
- Check GitHub issues for known problems
- Review code comments in source files
