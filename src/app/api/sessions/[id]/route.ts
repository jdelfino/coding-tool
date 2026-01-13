import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';
import { cleanupSandbox } from '@/server/vercel-sandbox';

/**
 * DELETE /api/sessions/:id
 *
 * End a session (mark as completed).
 * Only the session creator or admin can end a session.
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    // Authenticate user
    const user = await getAuthenticatedUser(request);

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
    if (codingSession.creatorId !== user.id && user.role !== 'namespace-admin' && user.role !== 'system-admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only the session creator or admin can end this session' },
        { status: 403 }
      );
    }

    // End the session via service
    await SessionService.endSession(storage, sessionId);

    // Clean up sandbox resources (Vercel Sandbox only, no-op locally)
    // Do this after endSession to avoid race conditions with in-flight executions
    await cleanupSandbox(sessionId);

    return NextResponse.json({
      success: true,
      message: 'Session ended successfully',
    });

  } catch (error: unknown) {
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

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
