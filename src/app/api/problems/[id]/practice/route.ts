/**
 * Practice mode API endpoint
 *
 * POST /api/problems/[id]/practice - Find or create a completed session for practice
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getNamespaceContext } from '@/server/auth/api-helpers';
import { createStorage } from '@/server/persistence';
import { SERVICE_ROLE_MARKER } from '@/server/supabase/client';
import * as SessionService from '@/server/services/session-service';
import { rateLimit } from '@/server/rate-limit';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * POST /api/problems/[id]/practice
 *
 * Find or create a completed session for a problem in a section.
 * This enables students to practice problems without affecting active sessions.
 *
 * Request body: { sectionId: string }
 * Response: { sessionId: string }
 */
export async function POST(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id: problemId } = await params;

    // Authenticate user
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user, accessToken } = auth;

    // Rate limit by user ID (write operation - creates session)
    const limited = await rateLimit('write', request, user.id);
    if (limited) return limited;

    const namespaceId = getNamespaceContext(request, user);
    if (!namespaceId) {
      return NextResponse.json(
        { error: 'Namespace context required' },
        { status: 400 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { sectionId } = body;

    if (!sectionId) {
      return NextResponse.json(
        { error: 'sectionId is required' },
        { status: 400 }
      );
    }

    // Create storage with user's access token for validation
    const userStorage = await createStorage(accessToken);

    // Validate problem exists
    const problem = await userStorage.problems.getById(problemId, namespaceId);
    if (!problem) {
      return NextResponse.json(
        { error: 'Problem not found' },
        { status: 404 }
      );
    }

    // Validate section membership
    const membership = await userStorage.memberships.getMembership(user.id, sectionId);
    if (!membership) {
      return NextResponse.json(
        { error: 'Not a member of this section' },
        { status: 403 }
      );
    }

    // Find existing practice session
    // Note: Use service role for broader query permissions
    const serviceStorage = await createStorage(SERVICE_ROLE_MARKER);
    const completedSessions = await serviceStorage.sessions.listAllSessions({
      sectionId,
      active: false,
      namespaceId,
    });

    // Find a completed session that uses this problem
    let session = completedSessions.find(s => s.problem?.id === problemId);

    // If no session found, create one
    if (!session) {
      // Create session with the problem
      session = await SessionService.createSessionWithProblem(
        serviceStorage,
        user.id,
        sectionId,
        namespaceId,
        problemId
      );

      // End the session immediately (mark as completed)
      await SessionService.endSession(serviceStorage, session.id);

      // Reload session to get updated status
      const updatedSession = await serviceStorage.sessions.getSession(session.id);
      if (updatedSession) {
        session = updatedSession;
      }
    }

    // Add student to session
    await SessionService.addStudent(
      serviceStorage,
      session,
      user.id,
      user.displayName || user.email || 'Student'
    );

    return NextResponse.json({ sessionId: session.id });
  } catch (error: any) {
    console.error('[API] Practice mode error:', error);
    return NextResponse.json(
      { error: 'Failed to create practice session' },
      { status: 500 }
    );
  }
}
