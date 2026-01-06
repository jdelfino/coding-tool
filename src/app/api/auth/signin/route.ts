/**
 * POST /api/auth/signin
 * Authenticate a user with email and password.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, password } = body;

    if (!email || !password || typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    const authProvider = await getAuthProvider();
    const user = await authProvider.authenticateWithPassword(email.trim(), password);

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid credentials' },
        { status: 401 }
      );
    }

    // Supabase sets JWT cookies automatically via SSR helpers
    // No manual cookie setting needed
    return NextResponse.json({ user });
  } catch (error) {
    console.error('[API] Sign in error:', error);
    return NextResponse.json(
      { error: 'Authentication failed' },
      { status: 500 }
    );
  }
}
