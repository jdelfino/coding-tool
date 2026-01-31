import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/api-helpers';
import { createStorage } from '@/server/persistence';
import { rateLimit } from '@/server/rate-limit';

/**
 * GET /api/sessions/history
 * Get session history for the current user
 * - Instructors see sessions they created
 * - Students see sessions they participated in
 *
 * Query Parameters:
 * - status: 'active' | 'completed' | 'all' (default: 'all')
 * - classId: filter by class ID
 * - search: search by section name or join code
 */
export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user, accessToken } = auth;

    // Rate limit by user ID (read operation)
    const limited = await rateLimit('read', request, user.id);
    if (limited) return limited;

    const storage = await createStorage(accessToken);
    let sessions;

    // Check permission for viewing sessions
    if (auth.rbac.hasPermission(user, 'session.viewAll')) {
      // Instructors see sessions they created
      sessions = await storage.sessions.listAllSessions({ instructorId: user.id });
    } else if (auth.rbac.hasPermission(user, 'session.viewOwn')) {
      // Students see sessions they participated in
      const allSessions = await storage.sessions.listAllSessions();
      sessions = allSessions.filter(s => s.participants.includes(user.id));
    } else {
      return NextResponse.json(
        { error: 'Forbidden: No session view permission' },
        { status: 403 }
      );
    }

    // Get query parameters
    const { searchParams } = new URL(request.url);
    const statusFilter = searchParams.get('status') || 'all';
    const _classIdFilter = searchParams.get('classId');
    const searchQuery = searchParams.get('search')?.toLowerCase();

    // Apply filters
    let filteredSessions = sessions;

    // Filter by status
    if (statusFilter === 'active') {
      filteredSessions = filteredSessions.filter(s => s.status === 'active');
    } else if (statusFilter === 'completed') {
      filteredSessions = filteredSessions.filter(s => s.status === 'completed');
    }

    // Filter by classId (would need section to class mapping - defer for now)
    // We could add classId to session model in the future

    // Filter by search query (section name)
    if (searchQuery) {
      filteredSessions = filteredSessions.filter(s =>
        s.sectionName.toLowerCase().includes(searchQuery)
      );
    }

    // Sort by lastActivity (most recent first)
    filteredSessions.sort((a, b) =>
      b.lastActivity.getTime() - a.lastActivity.getTime()
    );

    // Convert sessions to serializable format (Maps can't be JSON stringified)
    const sessionData = filteredSessions.map(session => ({
      id: session.id,
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
