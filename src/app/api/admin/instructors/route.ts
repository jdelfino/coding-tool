/**
 * POST /api/admin/instructors
 * Create a new instructor account.
 * Instructors only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';

export async function POST(request: NextRequest) {
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

    // Check if user is an instructor or admin
    if (session.user.role !== 'instructor' && session.user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Instructors only' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    // Create the instructor account
    const newUser = await authProvider.createUser(username.trim(), 'instructor');

    return NextResponse.json({ 
      user: newUser,
      message: 'Instructor account created successfully'
    });
  } catch (error: any) {
    console.error('[API] Create instructor error:', error);
    
    // Check for duplicate username error
    if (error.message?.includes('already taken')) {
      return NextResponse.json(
        { error: error.message },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Failed to create instructor' },
      { status: 500 }
    );
  }
}
