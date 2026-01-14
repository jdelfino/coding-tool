import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getNamespaceContext } from '@/server/auth/api-helpers';
import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';
import { getExecutorService } from '@/server/code-execution';

/**
 * GET /api/sessions
 *
 * List sessions for the authenticated user.
 * - Instructors see their created sessions
 * - Students see sessions they've joined
 *
 * Query params:
 * - status?: 'active' | 'completed' (optional - filter by status)
 */
export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { user } = auth;
    const namespaceId = getNamespaceContext(request, user);
    const storage = await getStorage();

    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') as 'active' | 'completed' | null;

    let userSessions;

    if (user.role === 'instructor' || user.role === 'namespace-admin' || user.role === 'system-admin') {
      const queryOptions: Record<string, unknown> = {
        instructorId: user.id,
        namespaceId,
      };

      if (statusFilter) {
        queryOptions.active = statusFilter === 'active';
      }

      userSessions = await storage.sessions.listAllSessions(queryOptions);
    } else {
      const allSessions = await storage.sessions.listAllSessions({ namespaceId });
      userSessions = allSessions.filter(s => s.participants.includes(user.id));

      if (statusFilter) {
        userSessions = userSessions.filter(s =>
          statusFilter === 'active' ? s.status === 'active' : s.status === 'completed'
        );
      }
    }

    const sessions = userSessions.map(s => ({
      id: s.id,
      sectionId: s.sectionId,
      sectionName: s.sectionName,
      status: s.status,
      createdAt: s.createdAt,
      endedAt: s.endedAt,
      problem: s.problem ? {
        id: s.problem.id,
        title: s.problem.title,
        description: s.problem.description,
      } : undefined,
      participantCount: s.participants.length,
    }));

    return NextResponse.json({ success: true, sessions });

  } catch (error) {
    console.error('Error listing sessions:', error);
    return NextResponse.json(
      { error: 'Failed to list sessions', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/sessions
 *
 * Create a new session, optionally from a problem.
 *
 * Body:
 * - sectionId: string (required)
 * - problemId?: string (optional - if provided, problem is cloned into session)
 */
export async function POST(request: NextRequest) {
  try {
    // Auth
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth;
    }

    const { user } = auth;
    const namespaceId = getNamespaceContext(request, user);

    // Only instructors can create sessions
    if (user.role !== 'instructor' && user.role !== 'namespace-admin' && user.role !== 'system-admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only instructors can create sessions' },
        { status: 403 }
      );
    }

    // Parse and validate request
    const body = await request.json();
    const { sectionId, problemId } = body;

    if (!sectionId) {
      return NextResponse.json({ error: 'sectionId is required' }, { status: 400 });
    }

    const storage = await getStorage();

    if (!storage.sections || !storage.memberships) {
      return NextResponse.json({ error: 'Class/section features not available' }, { status: 503 });
    }

    // Verify section exists and user is instructor in section
    const section = await storage.sections.getSection(sectionId, namespaceId);
    if (!section) {
      return NextResponse.json({ error: 'Section not found' }, { status: 404 });
    }

    const isInstructor = section.instructorIds.includes(user.id);
    const membership = await storage.memberships.getMembership(user.id, sectionId);
    const hasInstructorMembership = membership?.role === 'instructor';

    if (!isInstructor && !hasInstructorMembership) {
      return NextResponse.json(
        { error: 'Forbidden: You must be an instructor in this section' },
        { status: 403 }
      );
    }

    // Validate problem if provided
    if (problemId) {
      const problem = await storage.problems.getById(problemId, namespaceId);
      if (!problem) {
        return NextResponse.json({ error: 'Problem not found' }, { status: 404 });
      }
    }

    // Create session via service
    const newSession = problemId
      ? await SessionService.createSessionWithProblem(storage, user.id, sectionId, namespaceId, problemId)
      : await SessionService.createSession(storage, user.id, sectionId, namespaceId);

    // Prepare backend for the session (creates sandbox on Vercel, no-op locally)
    try {
      await getExecutorService().prepareForSession(newSession.id);
    } catch (error) {
      console.error('Failed to prepare backend for session:', error);
      // Continue without prepared backend - execution will show appropriate error
    }

    return NextResponse.json({
      success: true,
      session: {
        id: newSession.id,
        sectionId: newSession.sectionId,
        sectionName: newSession.sectionName,
        joinCode: section.joinCode,
        problem: newSession.problem,
        createdAt: newSession.createdAt,
        status: newSession.status,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating session:', error);

    // Handle service errors with appropriate status codes
    if (error instanceof Error) {
      if (error.message.includes('Cannot create session: User already has')) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      if (error.message.includes('not found')) {
        return NextResponse.json({ error: error.message }, { status: 404 });
      }
    }

    return NextResponse.json(
      { error: 'Failed to create session', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
