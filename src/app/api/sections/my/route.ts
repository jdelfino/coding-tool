/**
 * GET /api/sections/my - Get student's enrolled sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getMembershipRepository, getSectionRepository, getClassRepository } from '@/server/classes';

export async function GET(request: NextRequest) {
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

    // Get all sections for this user with class info
    const membershipRepo = await getMembershipRepository();
    const sectionsWithClass = await membershipRepo.getUserSections(session.user.id);

    // Transform to match frontend expectations (flat className instead of nested class object)
    // Also need to get role from membership
    const sections = await Promise.all(
      sectionsWithClass.map(async (sectionWithClass: any) => {
        // Get the membership to find the role
        const membership = await membershipRepo.getMembership(session.user.id, sectionWithClass.id);

        return {
          ...sectionWithClass,
          className: sectionWithClass.class.name,
          classDescription: sectionWithClass.class.description || '',
          role: membership?.role || 'student',
        };
      })
    );

    return NextResponse.json({ sections });
  } catch (error) {
    console.error('[API] Get my sections error:', error);
    return NextResponse.json(
      { error: 'Failed to get sections' },
      { status: 500 }
    );
  }
}
