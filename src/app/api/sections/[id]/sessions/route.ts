/**
 * GET /api/sections/:id/sessions - Get sessions for a section
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getSectionRepository, getMembershipRepository } from '@/server/classes';
import { getStorage } from '@/server/persistence';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    // Authenticate using Supabase session from request
    const authProvider = await getAuthProvider();
    const authSession = await authProvider.getSessionFromRequest(request);

    if (!authSession || !authSession.user) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const sectionRepo = await getSectionRepository();
    const section = await sectionRepo.getSection(id);

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Check if user has access to this section
    // Access granted if: user is a section instructor OR a member (student/instructor)
    const isInstructor = section.instructorIds.includes(authSession.user.id);

    if (!isInstructor) {
      const membershipRepo = await getMembershipRepository();
      const membership = await membershipRepo.getMembership(authSession.user.id, id);

      if (!membership) {
        return NextResponse.json(
          { error: 'You do not have access to this section' },
          { status: 403 }
        );
      }
    }

    // Get sessions for this section from storage
    const storage = await getStorage();
    const allSessions = await storage.sessions.listAllSessions();
    const sessions = allSessions.filter(s => s.sectionId === id);

    return NextResponse.json({ sessions });
  } catch (error) {
    console.error('[API] Get section sessions error:', error);
    return NextResponse.json(
      { error: 'Failed to get section sessions' },
      { status: 500 }
    );
  }
}
