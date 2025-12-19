import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { sessionManagerHolder } from '@/server/session-manager';

/**
 * GET /api/sessions/history
 * Get session history for the current user
 * - Instructors see sessions they created
 * - Students see sessions they participated in
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const authProvider = await getAuthProvider();
    const session = await authProvider.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      );
    }

    const user = session.user;
    let sessions;
    
    if (user.role === 'instructor') {
      // Instructors see sessions they created
      sessions = await sessionManagerHolder.instance.getSessionsByCreator(user.id);
    } else {
      // Students see sessions they participated in
      sessions = await sessionManagerHolder.instance.getSessionsByParticipant(user.id);
    }

    // Convert sessions to serializable format (Maps can't be JSON stringified)
    const sessionData = sessions.map(session => ({
      id: session.id,
      joinCode: session.joinCode,
      problemText: session.problemText,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      creatorId: session.creatorId,
      participantCount: session.participants.length,
      status: session.status,
      endedAt: session.endedAt?.toISOString(),
    }));

    return NextResponse.json({ sessions: sessionData });
  } catch (error) {
    console.error('Error fetching session history:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
