/**
 * GET /api/sections/:id/sessions - Get sessions for a section
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getSectionRepository, getMembershipRepository } from '@/server/classes';
import { getSessionManager } from '@/server';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const sectionRepo = getSectionRepository();
    const section = await sectionRepo.getSection(id);

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Check if user is a member of this section
    const membershipRepo = getMembershipRepository();
    const membership = await membershipRepo.getMembership(session.user.id, id);

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this section' },
        { status: 403 }
      );
    }

    // Get sessions for this section
    const sessionManager = getSessionManager();
    const sessions = await sessionManager.getSessionsBySection(id);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[API] Get section sessions error:', error);
    return NextResponse.json(
      { error: 'Failed to get section sessions' },
      { status: 500 }
    );
  }
}
