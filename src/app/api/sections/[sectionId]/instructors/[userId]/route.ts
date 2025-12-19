/**
 * DELETE /api/sections/:sectionId/instructors/:userId - Remove an instructor from a section
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getSectionRepository, getMembershipRepository } from '@/server/classes';

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ sectionId: string; userId: string }> }
) {
  try {
    const { sectionId, userId } = await params;
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
    const section = await sectionRepo.getSection(sectionId);

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Check if user is an instructor of this section
    if (!section.instructorIds.includes(session.user.id)) {
      return NextResponse.json(
        { error: 'Only section instructors can remove instructors' },
        { status: 403 }
      );
    }

    // Prevent removing the last instructor
    if (section.instructorIds.length === 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last instructor from a section' },
        { status: 400 }
      );
    }

    // Remove instructor from section
    const membershipRepo = getMembershipRepository();
    await membershipRepo.removeMembership(userId, sectionId);

    // Update section instructorIds
    await sectionRepo.removeInstructor(sectionId, userId);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Remove instructor error:', error);
    return NextResponse.json(
      { error: 'Failed to remove instructor' },
      { status: 500 }
    );
  }
}
