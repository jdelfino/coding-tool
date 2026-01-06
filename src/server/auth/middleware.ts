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
 * Validates JWT session and attaches user to request.
 */
export function createAuthMiddleware(authProvider: IAuthProvider) {
  return async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // Get JWT access token from cookie or header
      const accessToken = req.cookies?.['sb-access-token'] || req.headers['authorization']?.replace('Bearer ', '');

      if (!accessToken) {
        return res.status(401).json({ error: 'Not authenticated' });
      }

      // Validate JWT and get session
      const session = await authProvider.getSession(accessToken);

      if (!session || !session.user) {
        return res.status(401).json({ error: 'Invalid session' });
      }

      // Attach user and sessionId (JWT token) to request
      req.user = session.user;
      req.sessionId = session.sessionId;

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

  if (req.user.role !== 'namespace-admin' && req.user.role !== 'system-admin') {
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
 * Authenticate a WebSocket connection using JWT from cookies.
 * JWT tokens (sb-access-token) are automatically sent by browser in WebSocket handshake.
 */
export async function authenticateWebSocket(
  ws: AuthenticatedWebSocket,
  request: IncomingMessage,
  authProvider: IAuthProvider
): Promise<User | null> {
  try {
    // Parse cookies from WebSocket handshake request
    const cookieHeader = request.headers.cookie || '';
    const cookies: Record<string, string> = {};
    cookieHeader.split(';').forEach(cookie => {
      const [name, value] = cookie.trim().split('=');
      if (name && value) {
        cookies[name] = decodeURIComponent(value);
      }
    });

    // Get JWT access token from cookies
    const accessToken = cookies['sb-access-token'];

    if (!accessToken) {
      console.warn('[WebSocket Auth] No JWT access token in cookies');
      return null;
    }

    // Validate JWT and get session
    const session = await authProvider.getSession(accessToken);

    if (session && session.user) {
      ws.user = session.user;
      ws.sessionId = session.sessionId;
      return session.user;
    }

    return null;
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
