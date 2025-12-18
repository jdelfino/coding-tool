/**
 * GET /api/auth/me
 * Get the current authenticated user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const authProvider = getAuthProvider();
    const session = authProvider.getSession(sessionId);

    if (!session) {
      // Session invalid or expired
      const response = NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      );
      response.cookies.delete('sessionId');
      return response;
    }

    return NextResponse.json({
      user: session.user,
      sessionId: session.sessionId,
    });
  } catch (error) {
    console.error('[API] Get current user error:', error);
    return NextResponse.json(
      { error: 'Failed to get user' },
      { status: 500 }
    );
  }
}
