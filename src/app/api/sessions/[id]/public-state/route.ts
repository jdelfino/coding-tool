/**
 * GET /api/sessions/[id]/public-state
 * Load session state for public display (no auth required)
 * Only returns data safe for public display: problem, join code, featured code
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/server/persistence';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: sessionId } = await params;

    const storage = await getStorage();
    const session = await storage.sessions.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get the section for join code
    const section = await storage.sections?.getSection(session.sectionId, session.namespaceId);

    // Return only public-safe data
    return NextResponse.json({
      sessionId: session.id,
      joinCode: section?.joinCode || '',
      problem: session.problem,
      featuredStudentId: session.featuredStudentId || null,
      featuredCode: session.featuredCode || null,
      hasFeaturedSubmission: Boolean(session.featuredStudentId && session.featuredCode),
    });
  } catch (error: unknown) {
    console.error('[API] Get public session state error:', error);
    return NextResponse.json(
      { error: 'Failed to load session state' },
      { status: 500 }
    );
  }
}
