/**
 * Duplicate problem endpoint
 *
 * POST /api/problems/[id]/duplicate
 *
 * Creates a copy of an existing problem, owned by the caller.
 * Only instructors and admins can duplicate problems.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createStorage } from '@/server/persistence';
import { requireAuth, getNamespaceContext } from '@/server/auth/api-helpers';
import { rateLimit } from '@/server/rate-limit';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * POST /api/problems/[id]/duplicate
 *
 * Duplicate a problem.
 * - requireAuth; roles below instructor get 403 (inline check, same as POST /api/problems).
 * - Loads the original scoped to caller's namespace; 404 if not found.
 * - Creates a copy with title = original.title + ' (copy)' and authorId = caller.
 * - Returns { problem } with 201.
 */
export async function POST(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user, accessToken } = auth;

    // Rate limit by user ID (write operation)
    const limited = await rateLimit('write', request, user.id);
    if (limited) return limited;

    // Only instructors and admins can duplicate problems
    if (user.role !== 'instructor' && user.role !== 'namespace-admin' && user.role !== 'system-admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only instructors can duplicate problems' },
        { status: 403 }
      );
    }

    const namespaceId = getNamespaceContext(request, user);
    const storage = await createStorage(accessToken);

    // Load the original, scoped to caller's namespace (returns null for other namespaces)
    const original = await storage.problems.getById(id, namespaceId);
    if (!original) {
      return NextResponse.json(
        { error: 'Problem not found' },
        { status: 404 }
      );
    }

    const newTitle = `${original.title} (copy)`;

    // Duplicate with caller as the new author so they can edit it under RLS
    const problem = await storage.problems.duplicate(id, newTitle, user.id);

    return NextResponse.json({ problem }, { status: 201 });
  } catch (error: any) {
    console.error('Error duplicating problem:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to duplicate problem' },
      { status: 500 }
    );
  }
}
