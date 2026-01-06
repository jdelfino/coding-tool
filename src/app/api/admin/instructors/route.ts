/**
 * POST /api/admin/instructors
 * Create a new instructor account.
 * Requires 'user.create' permission.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { requirePermission, getNamespaceContext } from '@/server/auth/api-helpers';

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization
    const auth = await requirePermission(request, 'user.create');
    if (auth instanceof NextResponse) {
      return auth; // Return 401/403 error response
    }

    const { user } = auth;
    const namespaceId = getNamespaceContext(request, user);

    const body = await request.json();
    const { email, username, password } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    if (!password || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Password is required' },
        { status: 400 }
      );
    }

    // Create the instructor account in the user's namespace
    const authProvider = await getAuthProvider();
    const newUser = await authProvider.signUp(
      email.trim(),
      password,
      username.trim(),
      'instructor',
      namespaceId
    );

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
