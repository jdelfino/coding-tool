/**
 * POST /api/problems/[id]/duplicate
 *
 * Duplicate a problem, optionally porting it to another class.
 *
 * The copy is always authored by the requesting user (authorId = current user),
 * regardless of who authored the source. This ensures the copier has RLS-backed
 * ownership over the duplicate.
 *
 * Authorization:
 * - Requires problem.create permission (instructor / namespace-admin / system-admin).
 * - When targetClassId is provided: instructor must own the target class
 *   (classes.createdBy === user.id). namespace-admin and system-admin skip this check.
 *
 * Request body: { title: string (required, non-blank), targetClassId?: string }
 * Responses:
 *   201 { problem }
 *   400 blank title
 *   401 unauthenticated
 *   403 student, or target class not owned by instructor
 *   404 source problem not visible in namespace, or target class not found
 */

import { NextRequest, NextResponse } from 'next/server';
import { createStorage } from '@/server/persistence';
import { requirePermission, getNamespaceContext } from '@/server/auth/api-helpers';
import { getClassRepository } from '@/server/classes';
import { rateLimit } from '@/server/rate-limit';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: NextRequest, { params }: Params) {
  try {
    const { id } = await params;

    // Auth gate: only users with problem.create permission may duplicate problems.
    // Students have problem.read but NOT problem.create, so they receive 403 here.
    const auth = await requirePermission(request, 'problem.create');
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { user, accessToken } = auth;

    // Rate limit write operations by user ID.
    const limited = await rateLimit('write', request, user.id);
    if (limited) return limited;

    // Parse and validate body.
    const body = await request.json();
    const { title, targetClassId } = body as { title?: string; targetClassId?: string };

    if (!title || title.trim() === '') {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const namespaceId = getNamespaceContext(request, user);
    const storage = await createStorage(accessToken);

    // Verify the source problem is visible in the caller's namespace.
    const source = await storage.problems.getById(id, namespaceId);
    if (!source) {
      return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
    }

    // Resolve target class: validate ownership when a cross-class port is requested.
    let resolvedClassId = source.classId;

    if (targetClassId && targetClassId !== source.classId) {
      const classRepo = getClassRepository(accessToken);
      const targetClass = await classRepo.getClass(targetClassId, namespaceId);

      if (!targetClass) {
        return NextResponse.json({ error: 'Target class not found' }, { status: 404 });
      }

      // Custom ownership check: instructors may only target their own classes.
      // namespace-admin and system-admin skip this check (they manage any class in scope).
      if (user.role === 'instructor' && targetClass.createdBy !== user.id) {
        return NextResponse.json(
          { error: 'You do not own the target class' },
          { status: 403 }
        );
      }

      resolvedClassId = targetClassId;
    }

    const problem = await storage.problems.duplicate(id, {
      title: title.trim(),
      classId: resolvedClassId,
      authorId: user.id,
    });

    return NextResponse.json({ problem }, { status: 201 });
  } catch (error: any) {
    console.error('Error duplicating problem:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to duplicate problem' },
      { status: 500 }
    );
  }
}
