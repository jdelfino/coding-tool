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

    // Get all sections for this user
    const membershipRepo = await getMembershipRepository();
    const memberships = await membershipRepo.getUserSections(session.user.id);

    // Get full section details for each
    const sectionRepo = await getSectionRepository();
    const classRepo = await getClassRepository();

    const sectionsWithDetails = await Promise.all(
      memberships.map(async (membership: any) => {
        const section = await sectionRepo.getSection(membership.sectionId);
        if (!section) return null;

        const classData = await classRepo.getClass(section.classId);

        return {
          ...section,
          className: classData?.name || 'Unknown Class',
          classDescription: classData?.description || '',
          role: membership.role,
        };
      })
    );

    const sections = sectionsWithDetails.filter((s: any) => s !== null);

    return NextResponse.json({ sections });
  } catch (error) {
    console.error('[API] Get my sections error:', error);
    return NextResponse.json(
      { error: 'Failed to get sections' },
      { status: 500 }
    );
  }
}
