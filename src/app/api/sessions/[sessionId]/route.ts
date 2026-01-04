import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getSessionManager } from '@/server/session-manager';
import { getStorage } from '@/server/persistence';

/**
 * DELETE /api/sessions/:sessionId
 *
 * End a session (mark as completed).
 * Only the session creator or admin can end a session.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sessionId: string }> }
) {
  try {
    const { sessionId } = await params;

    // Authenticate user
    const authSessionId = request.cookies.get('sessionId')?.value;
    if (!authSessionId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const authProvider = await getAuthProvider();
    const session = await authProvider.getSession(authSessionId);
    if (!session) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const user = session.user;

    // Get the session to verify it exists and check ownership
    const storage = await getStorage();
    const codingSession = await storage.sessions.getSession(sessionId);

    if (!codingSession) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Verify user is the creator or an admin
    if (codingSession.creatorId !== user.id && user.role !== 'namespace-admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only the session creator or admin can end this session' },
        { status: 403 }
      );
    }

    // End the session (marks as completed, preserves data)
    const sessionManager = await getSessionManager();
    const success = await sessionManager.endSession(sessionId);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to end session' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Session ended successfully',
    });

  } catch (error) {
    console.error('Error ending session:', error);
    return NextResponse.json(
      {
        error: 'Failed to end session',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
