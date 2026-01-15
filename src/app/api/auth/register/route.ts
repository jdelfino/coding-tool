/**
 * POST /api/auth/register
 * Register a new user account.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider, getNamespaceRepository } from '@/server/auth';
import { UserRole } from '@/server/auth/types';
import { rateLimit } from '@/server/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit by IP to prevent abuse
  const limited = await rateLimit('auth', request);
  if (limited) return limited;

  try {
    const body = await request.json();
    const { email, password, username, namespaceId } = body;

    // Validation
    if (!email || !password || !username) {
      return NextResponse.json(
        { error: 'Email, password, and username are required' },
        { status: 400 }
      );
    }

    // Determine role based on SYSTEM_ADMIN_EMAIL
    let role: UserRole = 'student'; // Default role
    let finalNamespaceId = namespaceId;

    if (email === process.env.SYSTEM_ADMIN_EMAIL) {
      role = 'system-admin';
      finalNamespaceId = null;
    } else if (!namespaceId) {
      // Non-admin users must provide namespace
      return NextResponse.json(
        { error: 'Namespace ID required for non-admin users' },
        { status: 400 }
      );
    } else {
      // Validate namespace exists
      const namespaceRepo = await getNamespaceRepository();
      const namespace = await namespaceRepo.getNamespace(namespaceId);
      if (!namespace) {
        return NextResponse.json(
          { error: 'Invalid namespace ID' },
          { status: 400 }
        );
      }
    }

    const authProvider = await getAuthProvider();
    const user = await authProvider.signUp(
      email,
      password,
      username,
      role,
      finalNamespaceId
    );

    // Auto sign-in after registration
    await authProvider.authenticateWithPassword(email, password);

    return NextResponse.json({ user }, { status: 201 });
  } catch (error: any) {
    console.error('[API] Registration error:', error);

    if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
      return NextResponse.json(
        { error: 'User with this email already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      { error: 'Registration failed' },
      { status: 500 }
    );
  }
}
