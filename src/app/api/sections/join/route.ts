/**
 * POST /api/sections/join - Join a section using a join code
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/server/auth/api-helpers';
import { getSectionRepository, getMembershipRepository } from '@/server/classes';
import { rateLimit } from '@/server/rate-limit';

export async function POST(request: NextRequest) {
  // Rate limit by IP to prevent join code brute force attacks
  const limited = await rateLimit('join', request);
  if (limited) return limited;

  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user } = auth;

    const body = await request.json();
    const { joinCode } = body;

    if (!joinCode || typeof joinCode !== 'string') {
      return NextResponse.json(
        { error: 'Join code is required' },
        { status: 400 }
      );
    }

    // Find section by join code (join codes are globally unique)
    const sectionRepo = await getSectionRepository();
    const section = await sectionRepo.getSectionByJoinCode(joinCode.toUpperCase().trim());

    if (!section) {
      return NextResponse.json(
        { error: 'Invalid join code' },
        { status: 404 }
      );
    }

    // Validate user's namespace matches section's namespace
    if (section.namespaceId !== user.namespaceId) {
      return NextResponse.json(
        { error: 'Cannot join section from a different organization' },
        { status: 403 }
      );
    }

    // Check if already a member
    const membershipRepo = await getMembershipRepository();
    const existingMembership = await membershipRepo.getMembership(user.id, section.id);

    if (existingMembership) {
      return NextResponse.json(
        { error: 'You are already a member of this section', section },
        { status: 200 }
      );
    }

    // Add student to section
    await membershipRepo.addMembership({
      userId: user.id,
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
