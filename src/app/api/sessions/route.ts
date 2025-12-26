import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getSessionManager } from '@/server/session-manager';
import { getStorage } from '@/server/persistence';

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
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const authProvider = await getAuthProvider();
    const session = await authProvider.getSession(sessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = session.user;

    // Only instructors and admins can create sessions
    if (user.role !== 'instructor' && user.role !== 'admin') {
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
    
    const section = await storage.sections.getSection(sectionId);
    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Verify user is an instructor in this section
    const membership = await storage.memberships.getMembership(user.id, sectionId);
    if (!membership || membership.role !== 'instructor') {
      return NextResponse.json(
        { error: 'Forbidden: You must be an instructor in this section' },
        { status: 403 }
      );
    }

    // If problemId provided, load the problem
    let problem = undefined;
    if (problemId) {
      const problemResult = await storage.problems.getById(problemId);
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
        joinCode: newSession.joinCode,
        sectionId: newSession.sectionId,
        sectionName: newSession.sectionName,
        problem: newSession.problem,
        createdAt: newSession.createdAt,
        status: newSession.status,
      }
    }, { status: 201 });

  } catch (error) {
    console.error('Error creating session:', error);
    return NextResponse.json(
      { 
        error: 'Failed to create session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
