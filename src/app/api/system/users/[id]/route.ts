/**
 * System Admin API - Individual User Management
 *
 * PUT /api/system/users/[id] - Update user (change role)
 * DELETE /api/system/users/[id] - Delete user
 */

import { NextRequest, NextResponse } from 'next/server';
import { requirePermission } from '@/server/auth/api-helpers';
import { getUserRepository, getAuthProvider } from '@/server/auth';

/**
 * PUT /api/system/users/[id]
 *
 * Update a user (system-admin only)
 * Currently supports changing role only
 *
 * Body:
 * - role?: 'namespace-admin' | 'instructor' | 'student'
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require system-admin permission
    const permissionCheck = await requirePermission(request, 'user.changeRole');
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck;
    }

    const { id: userId } = await params;
    const body = await request.json();
    const { role } = body;

    // Validate inputs
    if (!role) {
      return NextResponse.json(
        { error: 'Role is required' },
        { status: 400 }
      );
    }

    if (!['namespace-admin', 'instructor', 'student'].includes(role)) {
      return NextResponse.json(
        { error: 'Role must be namespace-admin, instructor, or student' },
        { status: 400 }
      );
    }

    // Check if user exists
    const userRepo = await getUserRepository();
    const user = await userRepo.getUser(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent changing system-admin role via this endpoint
    if (user.role === 'system-admin') {
      return NextResponse.json(
        { error: 'Cannot modify system administrator role' },
        { status: 403 }
      );
    }

    // Update user role
    const authProvider = await getAuthProvider();
    await authProvider.updateUser(userId, { role });

    // Fetch updated user
    const updatedUser = await userRepo.getUser(userId);

    return NextResponse.json({
      success: true,
      user: updatedUser,
    });

  } catch (error) {
    console.error('Error updating user:', error);
    return NextResponse.json(
      {
        error: 'Failed to update user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/system/users/[id]
 *
 * Delete a user (system-admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Require system-admin permission
    const permissionCheck = await requirePermission(request, 'user.delete');
    if (permissionCheck instanceof NextResponse) {
      return permissionCheck;
    }

    const { id: userId } = await params;

    // Check if user exists
    const userRepo = await getUserRepository();
    const user = await userRepo.getUser(userId);
    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // Prevent deleting system-admin via this endpoint
    if (user.role === 'system-admin') {
      return NextResponse.json(
        { error: 'Cannot delete system administrator' },
        { status: 403 }
      );
    }

    // Delete user
    const authProvider = await getAuthProvider();
    await authProvider.deleteUser(userId);

    return NextResponse.json({
      success: true,
      message: 'User deleted successfully',
    });

  } catch (error) {
    console.error('Error deleting user:', error);
    return NextResponse.json(
      {
        error: 'Failed to delete user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
