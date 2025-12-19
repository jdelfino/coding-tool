/**
 * DELETE /api/admin/users/[id]
 * Delete a user account.
 * Instructors only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Check authentication
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const authProvider = await getAuthProvider();
    const session = authProvider.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Invalid session' },
        { status: 401 }
      );
    }

    // Check if user is an instructor
    if (session.user.role !== 'instructor') {
      return NextResponse.json(
        { error: 'Forbidden: Instructors only' },
        { status: 403 }
      );
    }

    const { id: userId } = await params;

    // Prevent self-deletion
    if (userId === session.user.id) {
      return NextResponse.json(
        { error: 'Cannot delete your own account' },
        { status: 400 }
      );
    }

    // Check if it's the last instructor
    const userRepo = (authProvider as any).userRepository;
    if (!userRepo) {
      return NextResponse.json(
        { error: 'User repository not available' },
        { status: 500 }
      );
    }

    const targetUser = await userRepo.getUser(userId);
    if (!targetUser) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    // If deleting an instructor, check if they're the last one
    if (targetUser.role === 'instructor') {
      const instructors = await userRepo.listUsers('instructor');
      if (instructors.length <= 1) {
        return NextResponse.json(
          { error: 'Cannot delete the last instructor' },
          { status: 400 }
        );
      }
    }

    // Delete the user
    await authProvider.deleteUser(userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Delete user error:', error);
    return NextResponse.json(
      { error: 'Failed to delete user' },
      { status: 500 }
    );
  }
}
