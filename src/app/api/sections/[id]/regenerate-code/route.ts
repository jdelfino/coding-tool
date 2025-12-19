/**
 * POST /api/sections/:id/regenerate-code - Regenerate join code for a section
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getSectionRepository } from '@/server/classes';

export async function POST(
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

    // Check if user is an instructor of this section
    if (!section.instructorIds.includes(session.user.id)) {
      return NextResponse.json(
        { error: 'Only section instructors can regenerate join codes' },
        { status: 403 }
      );
    }

    const newJoinCode = await sectionRepo.regenerateJoinCode(id);

    return NextResponse.json({ joinCode: newJoinCode });
  } catch (error) {
    console.error('[API] Regenerate join code error:', error);
    return NextResponse.json(
      { error: 'Failed to regenerate join code' },
      { status: 500 }
    );
  }
}
