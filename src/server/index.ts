import express from 'express';
import { createServer } from 'http';
import { WebSocketServer } from 'ws';
import next from 'next';
import { wsHandler } from './websocket-handler';

const dev = process.env.NODE_ENV !== 'production';
const hostname = 'localhost';
const port = parseInt(process.env.PORT || '3000', 10);

const app = next({ 
  dev, 
  hostname, 
  port,
});
const handle = app.getRequestHandler();

app.prepare().then(() => {
  const expressApp = express();
  const server = createServer(expressApp);
  
  // Initialize WebSocket server
  const wss = new WebSocketServer({ server, path: '/ws' });
  wsHandler.initialize(wss);
  
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
});
