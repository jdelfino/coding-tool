/**
 * Authentication and authorization middleware.
 * Provides middleware functions for HTTP routes and WebSocket connections.
 */

import { Request, Response, NextFunction } from 'express';
import { IncomingMessage } from 'http';
import WebSocket from 'ws';
import { User, AuthenticationError, AuthorizationError } from './types';
import { IAuthProvider } from './interfaces';
import { RBACService } from './rbac';

/**
 * Extended request with user information.
 */
export interface AuthenticatedRequest extends Request {
  user?: User;
  sessionId?: string;
}

/**
 * Extended WebSocket with user information.
 */
export interface AuthenticatedWebSocket extends WebSocket {
  user?: User;
  sessionId?: string;
}

/**
 * Create authentication middleware for Express routes.
 * Validates session and attaches user to request.
 */
export function createAuthMiddleware(authProvider: IAuthProvider) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Get session ID from cookie or header
      const sessionId = req.cookies?.sessionId || req.headers['x-session-id'];

      if (!sessionId) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Get user from session
      const user = await authProvider.getUserFromSession(sessionId);

      if (!user) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      // Attach user and sessionId to request
      req.user = user;
      req.sessionId = sessionId;

      next();
    } catch (error) {
      console.error('[Auth Middleware] Error:', error);
      res.status(500).json({ error: 'Authentication error' });
    }
  };
}

/**
 * Create middleware to require a specific role.
 */
export function createRoleMiddleware(requiredRole: User['role']) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (req.user.role !== requiredRole) {
      return res.status(403).json({ 
        error: `Access denied. ${requiredRole} role required.` 
      });
    }

    next();
  };
}

/**
 * Middleware to require admin role.
 * Convenience wrapper around createRoleMiddleware for admin-only routes.
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  if (req.user.role !== 'admin') {
    return res.status(403).json({ 
      error: 'Access denied. Administrator privileges required.' 
    });
  }

  next();
}

/**
 * Create middleware to require a specific permission.
 */
export function createPermissionMiddleware(rbacService: RBACService, permission: string) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    if (!rbacService.hasPermission(req.user, permission)) {
      return res.status(403).json({ 
        error: `Access denied. Permission required: ${permission}` 
      });
    }

    next();
  };
}

/**
 * Authenticate a WebSocket connection.
 * Extracts session from URL query params or initial message.
 */
export async function authenticateWebSocket(
  ws: AuthenticatedWebSocket,
  request: IncomingMessage,
  authProvider: IAuthProvider
): Promise<User | null> {
  try {
    // Try to get session ID from URL query params
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    const sessionId = url.searchParams.get('sessionId');

    if (!sessionId) {
      console.warn('[WebSocket Auth] No session ID provided');
      return null;
    }

    // Get user from session
    const user = await authProvider.getUserFromSession(sessionId);

    if (user) {
      ws.user = user;
      ws.sessionId = sessionId;
    }

    return user;
  } catch (error) {
    console.error('[WebSocket Auth] Error:', error);
    return null;
  }
}

/**
 * Check if a WebSocket connection is authenticated.
 */
export function isAuthenticated(ws: AuthenticatedWebSocket): boolean {
  return !!ws.user;
}

/**
 * Get the authenticated user from a WebSocket connection.
 * Throws if not authenticated.
 */
export function getAuthenticatedUser(ws: AuthenticatedWebSocket): User {
  if (!ws.user) {
    throw new AuthenticationError('WebSocket connection not authenticated');
  }
  return ws.user;
}

/**
 * Check if a WebSocket user has a specific permission.
 */
export function checkWebSocketPermission(
  ws: AuthenticatedWebSocket,
  rbacService: RBACService,
  permission: string
): boolean {
  if (!ws.user) {
    return false;
  }
  return rbacService.hasPermission(ws.user, permission);
}

/**
 * Assert that a WebSocket user has a specific permission.
 * Throws if not authenticated or lacks permission.
 */
export function assertWebSocketPermission(
  ws: AuthenticatedWebSocket,
  rbacService: RBACService,
  permission: string
): void {
  const user = getAuthenticatedUser(ws);
  rbacService.assertPermission(user, permission);
}
