/**
 * GET /api/sections/my - Get student's enrolled sections
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getNamespaceContext } from '@/server/auth/api-helpers';
import { getMembershipRepository } from '@/server/classes';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user } = auth;
    const namespaceId = getNamespaceContext(request, user);

    // Get all sections for this user with class info
    const membershipRepo = await getMembershipRepository();
    const sectionsWithClass = await membershipRepo.getUserSections(user.id, namespaceId);

    // Transform to match frontend expectations (flat className instead of nested class object)
    // Also need to get role from membership
    const sections = await Promise.all(
      sectionsWithClass.map(async (sectionWithClass: any) => {
        // Get the membership to find the role
        const membership = await membershipRepo.getMembership(user.id, sectionWithClass.id);

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
