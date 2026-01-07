/**
 * API endpoint for loading a problem into an active session
 * POST /api/sessions/:id/load-problem
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * POST /api/sessions/:id/load-problem
 *
 * Load a pre-defined problem into an active session
 *
 * Request body:
 * {
 *   problemId: string
 * }
 *
 * Response:
 * {
 *   success: boolean,
 *   message?: string
 * }
 */
export async function POST(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id: sessionId } = await params;

    // Verify authentication using Supabase session
    const authProvider = await getAuthProvider();
    const authSession = await authProvider.getSessionFromRequest(request);
    if (!authSession || !authSession.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Verify user is an instructor
    if (authSession.user.role !== 'instructor') {
      return NextResponse.json(
        { error: 'Only instructors can load problems into sessions' },
        { status: 403 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { problemId } = body;

    if (!problemId || typeof problemId !== 'string') {
      return NextResponse.json(
        { error: 'Invalid problemId' },
        { status: 400 }
      );
    }

    // Get storage
    const storage = await getStorage();

    // Verify session exists
    const session = await storage.sessions.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify instructor owns or has access to the session
    // TODO: Add proper permission check based on section membership
    // For now, just check if user is an instructor

    // Fetch problem from repository
    const problem = await storage.problems.getById(problemId);

    if (!problem) {
      return NextResponse.json(
        { error: 'Problem not found' },
        { status: 404 }
      );
    }

    // Verify instructor has access to this problem
    // Only the author can load their own problems
    // TODO: Add class-based permission check when class scoping is implemented
    const hasAccess = problem.authorId === authSession.user.id;

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'You do not have access to this problem' },
        { status: 403 }
      );
    }

    // Load problem into session via service
    await SessionService.updateSessionProblem(
      storage,
      sessionId,
      problem,
      problem.executionSettings
    );

    return NextResponse.json({
      success: true,
      message: `Problem "${problem.title}" loaded successfully`,
    });

  } catch (error) {
    console.error('Error loading problem into session:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
