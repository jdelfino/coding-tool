import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { sessionManagerHolder } from '@/server/session-manager';
import { requireAuth } from '@/server/auth/api-helpers';

/**
 * GET /api/sessions/history
 * Get session history for the current user
 * - Instructors see sessions they created
 * - Students see sessions they participated in
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const user = auth.user;
    let sessions;
    
    // Check permission for viewing sessions
    if (auth.rbac.hasPermission(user, 'session.viewAll')) {
      // Instructors see sessions they created
      sessions = await sessionManagerHolder.instance.getSessionsByCreator(user.id);
    } else if (auth.rbac.hasPermission(user, 'session.viewOwn')) {
      // Students see sessions they participated in
      sessions = await sessionManagerHolder.instance.getSessionsByParticipant(user.id);
    } else {
      return NextResponse.json(
        { error: 'Forbidden: No session view permission' },
        { status: 403 }
      );
    }

    // Convert sessions to serializable format (Maps can't be JSON stringified)
    const sessionData = sessions.map(session => ({
      id: session.id,
      joinCode: session.joinCode,
      problemTitle: session.problem?.title || 'Untitled Session',
      problemDescription: session.problem?.description,
      createdAt: session.createdAt.toISOString(),
      lastActivity: session.lastActivity.toISOString(),
      creatorId: session.creatorId,
      participantCount: session.participants.length,
      status: session.status,
      endedAt: session.endedAt?.toISOString(),
      sectionId: session.sectionId,
      sectionName: session.sectionName,
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
