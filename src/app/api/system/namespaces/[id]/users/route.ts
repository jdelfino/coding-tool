/**
 * System Admin API - Namespace User Management
 *
 * GET /api/system/namespaces/[id]/users - List users in namespace
 * POST /api/system/namespaces/[id]/users - Create user in namespace
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, requirePermission } from '@/server/auth/api-helpers';
import { getNamespaceRepository, getUserRepository, getAuthProvider } from '@/server/auth';

/**
 * GET /api/system/namespaces/[id]/users
 *
 * List all users in a namespace (system-admin only)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require system-admin permission
    const permissionCheck = await requirePermission(request, 'namespace.viewAll');
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck;
    }

    const { id: namespaceId } = await params;

    // Verify namespace exists
    const namespaceRepo = await getNamespaceRepository();
    const namespace = await namespaceRepo.getNamespace(namespaceId);
    if (!namespace) {
      return NextResponse.json(
        { error: 'Namespace not found' },
        { status: 404 }
      );
    }

    // Get all users in this namespace
    const userRepo = await getUserRepository();
    const allUsers = await userRepo.listUsers();
    const namespaceUsers = allUsers.filter(u => u.namespaceId === namespaceId);

    return NextResponse.json({
      success: true,
      users: namespaceUsers,
    });

  } catch (error) {
    console.error('Error listing namespace users:', error);
    return NextResponse.json(
      {
        error: 'Failed to list users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/system/namespaces/[id]/users
 *
 * Create a new user in a namespace (system-admin only)
 *
 * Body:
 * - username: string
 * - role: 'namespace-admin' | 'instructor' | 'student'
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require system-admin permission
    const permissionCheck = await requirePermission(request, 'user.create');
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck;
    }

    const { id: namespaceId } = await params;
    const body = await request.json();
    const { username, role } = body;

    // Validate inputs
    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (!role || !['namespace-admin', 'instructor', 'student'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be namespace-admin, instructor, or student' },
        { status: 400 }
      );
    }

    // Verify namespace exists
    const namespaceRepo = await getNamespaceRepository();
    const namespace = await namespaceRepo.getNamespace(namespaceId);
    if (!namespace) {
      return NextResponse.json(
        { error: 'Namespace not found' },
        { status: 404 }
      );
    }

    // Check if username already exists
    const userRepo = await getUserRepository();
    const existingUser = await userRepo.getUserByUsername(username.trim());
    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 409 }
      );
    }

    // Create user
    const authProvider = await getAuthProvider();
    const user = await authProvider.createUser(username.trim(), role, namespaceId);

    return NextResponse.json({
      success: true,
      user,
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      {
        error: 'Failed to create user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
