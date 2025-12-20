/**
 * Authorization helper for Next.js API routes.
 * Provides reusable functions for checking permissions in API routes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from './instance';
import { RBACService } from './rbac';
import { User } from './types';

/**
 * Get the authenticated user and RBAC service from a request.
 * Returns null if authentication fails.
 */
export async function getAuthContext(request: NextRequest): Promise<{
  user: User;
  rbac: RBACService;
} | null> {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return null;
    }

    const authProvider = await getAuthProvider();
    const session = await authProvider.getSession(sessionId);

    if (!session) {
      return null;
    }

    // Create RBAC service (it doesn't need storage for basic permission checks)
    const rbac = new RBACService();

    return {
      user: session.user,
      rbac,
    };
  } catch (error) {
    console.error('[Auth] Failed to get auth context:', error);
    return null;
  }
}

/**
 * Get the authenticated user from a session ID.
 * Returns null if authentication fails.
 */
export async function getUserFromSessionId(sessionId: string): Promise<User | null> {
  try {
    const authProvider = await getAuthProvider();
    const session = await authProvider.getSession(sessionId);
    return session?.user ?? null;
  } catch (error) {
    console.error('[Auth] Failed to get user from session:', error);
    return null;
  }
}

/**
 * Require authentication. Returns 401 response if not authenticated.
 * 
 * @param request - Next.js request object
 * @returns Auth context or 401 response
 */
export async function requireAuth(
  request: NextRequest
): Promise<{ user: User; rbac: RBACService } | NextResponse> {
  const auth = await getAuthContext(request);
  
  if (!auth) {
    return NextResponse.json(
      { error: 'Not authenticated' },
      { status: 401 }
    );
  }

  return auth;
}

/**
 * Require a specific permission. Returns 401 or 403 response if not authorized.
 * 
 * @param request - Next.js request object
 * @param permission - Required permission (e.g., 'user.create')
 * @returns Auth context or error response
 */
export async function requirePermission(
  request: NextRequest,
  permission: string
): Promise<{ user: User; rbac: RBACService } | NextResponse> {
  const auth = await requireAuth(request);
  
  // If requireAuth returned an error response, propagate it
  if (auth instanceof NextResponse) {
    return auth;
  }

  // Check permission
  if (!auth.rbac.hasPermission(auth.user, permission)) {
    return NextResponse.json(
      { error: `Forbidden: Requires ${permission} permission` },
      { status: 403 }
    );
  }

  return auth;
}

/**
 * Check if user has permission (doesn't return response, just boolean).
 * Useful for conditional logic in routes.
 */
export function hasPermission(user: User, permission: string): boolean {
  const rbac = new RBACService();
  return rbac.hasPermission(user, permission);
}

/**
 * Check multiple permissions (user must have ALL of them).
 */
export async function requireAllPermissions(
  request: NextRequest,
  permissions: string[]
): Promise<{ user: User; rbac: RBACService } | NextResponse> {
  const auth = await requireAuth(request);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  for (const permission of permissions) {
    if (!auth.rbac.hasPermission(auth.user, permission)) {
      return NextResponse.json(
        { error: `Forbidden: Requires ${permission} permission` },
        { status: 403 }
      );
    }
  }

  return auth;
}

/**
 * Check if user has ANY of the given permissions.
 */
export async function requireAnyPermission(
  request: NextRequest,
  permissions: string[]
): Promise<{ user: User; rbac: RBACService } | NextResponse> {
  const auth = await requireAuth(request);
  
  if (auth instanceof NextResponse) {
    return auth;
  }

  const hasAny = permissions.some(permission => 
    auth.rbac.hasPermission(auth.user, permission)
  );

  if (!hasAny) {
    return NextResponse.json(
      { error: `Forbidden: Requires one of: ${permissions.join(', ')}` },
      { status: 403 }
    );
  }

  return auth;
}
