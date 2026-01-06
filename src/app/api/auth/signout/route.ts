/**
 * POST /api/auth/signout
 * Sign out the current user.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';

export async function POST(request: NextRequest) {
  try {
    const authProvider = await getAuthProvider();
    await authProvider.signOut();

    // Supabase clears JWT cookies automatically
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Sign out error:', error);
    return NextResponse.json(
      { error: 'Sign out failed' },
      { status: 500 }
    );
  }
}
