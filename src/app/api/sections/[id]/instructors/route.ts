/**
 * POST /api/sections/:id/instructors - Add a co-instructor to a section
 * DELETE /api/sections/:id/instructors/:userId - Remove an instructor from a section
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getSectionRepository, getMembershipRepository } from '@/server/classes';
import { getUserRepository } from '@/server/auth';

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
        { error: 'Only section instructors can add co-instructors' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    // Find user by email
    const userRepo = getUserRepository();
    const user = await userRepo.getUserByEmail(email.toLowerCase().trim());

    if (!user) {
      return NextResponse.json(
        { error: 'User not found' },
        { status: 404 }
      );
    }

    if (user.role !== 'instructor') {
      return NextResponse.json(
        { error: 'User must be an instructor' },
        { status: 400 }
      );
    }

    // Add instructor to section
    const membershipRepo = getMembershipRepository();
    await membershipRepo.addMembership({
      userId: user.id,
      sectionId: id,
      role: 'instructor',
    });

    // Update section instructorIds
    await sectionRepo.addInstructor(id, user.id);

    return NextResponse.json({ success: true, instructor: user });
  } catch (error) {
    console.error('[API] Add instructor error:', error);
    return NextResponse.json(
      { error: 'Failed to add instructor' },
      { status: 500 }
    );
  }
}
