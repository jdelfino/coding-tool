/**
 * POST /api/sections/join - Join a section using a join code
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getSectionRepository, getMembershipRepository } from '@/server/classes';

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { joinCode } = body;

    if (!joinCode || typeof joinCode !== 'string') {
      return NextResponse.json(
        { error: 'Join code is required' },
        { status: 400 }
      );
    }

    // Find section by join code
    const sectionRepo = await getSectionRepository();
    const section = await sectionRepo.getSectionByJoinCode(joinCode.toUpperCase().trim());

    if (!section) {
      return NextResponse.json(
        { error: 'Invalid join code' },
        { status: 404 }
      );
    }

    // Check if already a member
    const membershipRepo = await getMembershipRepository();
    const existingMembership = await membershipRepo.getMembership(session.user.id, section.id);

    if (existingMembership) {
      return NextResponse.json(
        { error: 'You are already a member of this section', section },
        { status: 200 }
      );
    }

    // Add student to section
    await membershipRepo.addMembership({
      userId: session.user.id,
      sectionId: section.id,
      role: 'student',
    });

    return NextResponse.json({ 
      success: true, 
      section,
      message: 'Successfully joined section'
    }, { status: 201 });
  } catch (error) {
    console.error('[API] Join section error:', error);
    return NextResponse.json(
      { error: 'Failed to join section' },
      { status: 500 }
    );
  }
}
