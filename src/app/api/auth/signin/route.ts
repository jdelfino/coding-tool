/**
 * POST /api/auth/signin
 * Authenticate a user by username.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { username } = body;

    if (!username || typeof username !== 'string') {
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    const authProvider = await getAuthProvider();
    const user = await authProvider.authenticate(username.trim());

    if (!user) {
      return NextResponse.json(
        { error: 'Authentication failed' },
        { status: 401 }
      );
    }

    // Create session
    const session = authProvider.createSession(user);

    // Set session cookie
    const response = NextResponse.json({
      user,
      sessionId: session.sessionId,
    });

    response.cookies.set('sessionId', session.sessionId, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
  } catch (error) {
    console.error('[API] Sign in error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
