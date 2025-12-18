/**
 * POST /api/auth/signout
 * Sign out the current user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;

    if (sessionId) {
      const authProvider = getAuthProvider();
      authProvider.destroySession(sessionId);
    }

    // Clear session cookie
    const response = NextResponse.json({ success: true });
    response.cookies.delete('sessionId');

    return response;
  } catch (error) {
    console.error('[API] Sign out error:', error);
    return NextResponse.json(
      { error: 'Sign out failed' },
      { status: 500 }
    );
  }
}
