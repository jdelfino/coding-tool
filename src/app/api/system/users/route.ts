/**
 * System Admin API - User Management
 *
 * GET /api/system/users - List all users
 * POST /api/system/users - Create new user
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireSystemAdmin } from '@/server/auth/api-helpers';
import { getAuthProvider } from '@/server/auth';

/**
 * GET /api/system/users
 *
 * List all users (system-admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const authContext = await requireSystemAdmin(request);
    if (authContext instanceof NextResponse) {
      return authContext;  // Error response
    }

    // Use Supabase client to query user_profiles + auth.users
    const authProvider = await getAuthProvider();
    const supabase = authProvider.getSupabaseClient('admin');

    // Get all user profiles
    const { data: profiles, error } = await supabase
      .from('user_profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[Admin] List users error:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Fetch auth users for all profiles (to get emails)
    const users = await Promise.all(
      profiles.map(async (p: any) => {
        const { data: authUser } = await supabase.auth.admin.getUserById(p.id);
        return {
          id: p.id,
          username: p.username,
          email: authUser.user?.email || '',
          role: p.role,
          namespaceId: p.namespace_id,
          displayName: p.display_name,
          createdAt: p.created_at,
          lastLoginAt: p.last_login_at,
          emailConfirmed: authUser.user?.email_confirmed_at != null
        };
      })
    );

    return NextResponse.json({ users });

  } catch (error) {
    console.error('[Admin] List users error:', error);
    return NextResponse.json(
      {
        error: 'Failed to list users',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

/**
 * POST /api/system/users
 *
 * Create a new user (system-admin only)
 *
 * Body:
 * - email: string (required)
 * - password: string (required)
 * - username: string (required)
 * - role: 'system-admin' | 'namespace-admin' | 'instructor' | 'student' (required)
 * - namespaceId?: string (required for non-admin users)
 */
export async function POST(request: NextRequest) {
  try {
    const authContext = await requireSystemAdmin(request);
    if (authContext instanceof NextResponse) {
      return authContext;
    }

    const body = await request.json();
    const { email, password, username, role, namespaceId } = body;

    // Validation
    if (!email || !password || !username || !role) {
      return NextResponse.json(
        { error: 'Email, password, username, and role required' },
        { status: 400 }
      );
    }

    if (role !== 'system-admin' && !namespaceId) {
      return NextResponse.json(
        { error: 'Non-admin users must have a namespace' },
        { status: 400 }
      );
    }

    const authProvider = await getAuthProvider();
    const user = await authProvider.signUp(email, password, username, role, namespaceId || null);

    return NextResponse.json({ user }, { status: 201 });

  } catch (error) {
    console.error('[Admin] Create user error:', error);

    if (error instanceof Error && error.message?.includes('already exists')) {
      return NextResponse.json(
        { error: 'User already exists' },
        { status: 409 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create user',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
