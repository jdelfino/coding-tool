/**
 * GET /api/admin/users
 * List all users, optionally filtered by role.
 * Instructors only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import type { UserRole } from '@/server/auth/types';

export async function GET(request: NextRequest) {
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
    const session = await authProvider.getSession(sessionId);

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

    // Get role filter from query params
    const { searchParams } = new URL(request.url);
    const roleParam = searchParams.get('role') as UserRole | null;

    // Get user repository from auth provider
    const userRepo = (authProvider as any).userRepository;
    if (!userRepo || typeof userRepo.listUsers !== 'function') {
      return NextResponse.json(
        { error: 'User repository not available' },
        { status: 500 }
      );
    }

    // List users
    const users = await userRepo.listUsers(roleParam || undefined);

    return NextResponse.json({ users });
  } catch (error) {
    console.error('[API] List users error:', error);
    return NextResponse.json(
      { error: 'Failed to list users' },
      { status: 500 }
    );
  }
}
