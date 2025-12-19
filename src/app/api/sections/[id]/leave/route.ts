/**
 * DELETE /api/sections/:id/leave - Leave a section (student removes themselves)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getSectionRepository, getMembershipRepository } from '@/server/classes';

export async function DELETE(
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

    // Check if user is a member
    const membershipRepo = getMembershipRepository();
    const membership = await membershipRepo.getMembership(session.user.id, id);

    if (!membership) {
      return NextResponse.json(
        { error: 'You are not a member of this section' },
        { status: 400 }
      );
    }

    // Don't allow instructors to leave if they're the only one
    if (membership.role === 'instructor' && section.instructorIds.length === 1) {
      return NextResponse.json(
        { error: 'Cannot leave - you are the only instructor for this section' },
        { status: 400 }
      );
    }

    // Remove membership
    await membershipRepo.removeMembership(session.user.id, id);

    // If instructor, update section instructorIds
    if (membership.role === 'instructor') {
      await sectionRepo.removeInstructor(id, session.user.id);
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Leave section error:', error);
    return NextResponse.json(
      { error: 'Failed to leave section' },
      { status: 500 }
    );
  }
}
