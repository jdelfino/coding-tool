/**
 * API endpoint for loading a problem into an active session
 * POST /api/sessions/:sessionId/load-problem
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getStorage } from '@/server/persistence';
import { sessionManagerHolder } from '@/server/session-manager';

type Params = {
  params: Promise<{
    sessionId: string;
  }>;
};

/**
 * POST /api/sessions/:sessionId/load-problem
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
    const { sessionId } = await params;
    
    // Verify authentication
    const cookieSessionId = request.cookies.get('sessionId')?.value;
    if (!cookieSessionId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const authProvider = await getAuthProvider();
    const authSession = await authProvider.getSession(cookieSessionId);
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

    // Verify session exists
    const session = await sessionManagerHolder.instance.getSession(sessionId);
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
    const storage = await getStorage();
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

    // Load problem into session
    // SessionManager will clone the problem and broadcast via WebSocket
    const success = await sessionManagerHolder.instance.updateSessionProblem(
      sessionId,
      problem,
      problem.executionSettings
    );

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to load problem into session' },
        { status: 500 }
      );
    }

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
