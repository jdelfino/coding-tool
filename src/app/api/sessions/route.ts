import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getNamespaceContext } from '@/server/auth/api-helpers';
import { getSessionManager } from '@/server/session-manager';
import { getStorage } from '@/server/persistence';

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
    // Authenticate user
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user } = auth;
    const namespaceId = getNamespaceContext(request, user);
    const storage = await getStorage();

    // Get status filter from query params
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') as 'active' | 'completed' | null;

    let userSessions;

    if (user.role === 'instructor' || user.role === 'namespace-admin' || user.role === 'system-admin') {
      // Instructors see sessions they created
      const queryOptions: any = {
        instructorId: user.id,
        namespaceId,
      };

      if (statusFilter) {
        queryOptions.active = statusFilter === 'active';
      }

      userSessions = await storage.sessions.listAllSessions(queryOptions);
    } else {
      // Students see sessions they've joined
      // For now, we'll get all sessions and filter by participants
      // TODO: Add participantId filter to SessionQueryOptions for efficiency
      const allSessions = await storage.sessions.listAllSessions({ namespaceId });
      userSessions = allSessions.filter(s => s.participants.includes(user.id));

      if (statusFilter) {
        userSessions = userSessions.filter(s =>
          statusFilter === 'active' ? s.status === 'active' : s.status === 'completed'
        );
      }
    }

    // Return lightweight session data
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

    return NextResponse.json({
      success: true,
      sessions,
    });

  } catch (error) {
    console.error('Error listing sessions:', error);
    return NextResponse.json(
      {
        error: 'Failed to list sessions',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
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
    // Authenticate user
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user } = auth;
    const namespaceId = getNamespaceContext(request, user);

    // Only instructors and namespace admins can create sessions
    if (user.role !== 'instructor' && user.role !== 'namespace-admin' && user.role !== 'system-admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only instructors can create sessions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { sectionId, problemId } = body;

    if (!sectionId) {
      return NextResponse.json(
        { error: 'sectionId is required' },
        { status: 400 }
      );
    }

    // Get storage backend and verify section exists
    const storage = await getStorage();

    if (!storage.sections || !storage.memberships) {
      return NextResponse.json(
        { error: 'Class/section features not available' },
        { status: 503 }
      );
    }

    const section = await storage.sections.getSection(sectionId, namespaceId);
    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Verify user is an instructor in this section
    // Check both membership table and section's instructorIds array
    const isInstructor = section.instructorIds.includes(user.id);
    const membership = await storage.memberships.getMembership(user.id, sectionId);
    const hasInstructorMembership = membership?.role === 'instructor';

    if (!isInstructor && !hasInstructorMembership) {
      return NextResponse.json(
        { error: 'Forbidden: You must be an instructor in this section' },
        { status: 403 }
      );
    }

    // If problemId provided, load the problem
    let problem = undefined;
    if (problemId) {
      const problemResult = await storage.problems.getById(problemId, namespaceId);
      if (!problemResult) {
        return NextResponse.json(
          { error: 'Problem not found' },
          { status: 404 }
        );
      }
      problem = problemResult;
    }

    // Create the session
    const sessionManager = await getSessionManager();
    const newSession = await sessionManager.createSession(
      user.id,
      sectionId,
      section.name,
      problem
    );

    return NextResponse.json({
      success: true,
      session: {
        id: newSession.id,
        sectionId: newSession.sectionId,
        sectionName: newSession.sectionName,
        joinCode: section.joinCode, // Include section's join code for student access
        problem: newSession.problem,
        createdAt: newSession.createdAt,
        status: newSession.status,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating session:', error);

    // Handle single-session enforcement error
    if (error instanceof Error && error.message.includes('Cannot create session: User already has')) {
      return NextResponse.json(
        {
          error: error.message,
        },
        { status: 400 }
      );
    }

    return NextResponse.json(
      {
        error: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
