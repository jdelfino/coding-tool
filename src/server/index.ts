import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import next from 'next';
import { wsHandler } from './websocket-handler';
import { createDefaultStorage } from './persistence';
import { SessionManager, sessionManagerHolder } from './session-manager';
import { setStorage, initializeAuthProvider } from './auth';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ 
  dev, 
  hostname, 
  port,
});
const handle = app.getRequestHandler();

app.prepare().then(async () => {
  // Initialize persistence storage
  console.log('Initializing storage backend...');
  const storage = await createDefaultStorage();
  
  // Make storage available to auth provider immediately (before API routes might be called)
  setStorage(storage);
  
  // Initialize session manager with storage and replace the global singleton
  const sessionManagerInstance = new SessionManager(storage);
  await sessionManagerInstance.initialize();
  sessionManagerHolder.instance = sessionManagerInstance;
  
  console.log('Storage backend initialized successfully');

  // Initialize authentication provider with persistent user storage
  console.log('Initializing authentication provider...');
  initializeAuthProvider(storage);
  console.log('Authentication provider initialized successfully');

  const expressApp = express();
  const server = createServer(expressApp);
  
  // Create WebSocket server without automatic attachment (noServer: true)
  // This prevents it from taking over all upgrade events
  const wss = new WebSocketServer({ noServer: true });
  wsHandler.initialize(wss);
  
  // Manually handle upgrade events to route correctly
  server.on('upgrade', (request, socket, head) => {
    const { url } = request;
    
    // Only handle /ws path with our custom WebSocket server
    if (url?.startsWith('/ws')) {
      wss.handleUpgrade(request, socket, head, (ws) => {
        wss.emit('connection', ws, request);
      });
    }
    // All other WebSocket requests (like /_next/webpack-hmr) are ignored
    // and will be handled by Next.js HMR
  });
  
  // Health check endpoint
  expressApp.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });
  
  // Let Next.js handle all other routes
  expressApp.use((req, res) => {
    return handle(req, res);
  });
  
  server.listen(port, () => {
    console.log(`> Server ready on http://${hostname}:${port}`);
    console.log(`> WebSocket server ready on ws://${hostname}:${port}/ws`);
  });
  
  // Cleanup on server shutdown
  process.on('SIGINT', async () => {
    console.log('\nShutting down server...');
    await storage.shutdown();
    process.exit(0);
  });
  
  process.on('SIGTERM', async () => {
    console.log('\nShutting down server...');
    await storage.shutdown();
    process.exit(0);
  });
});
