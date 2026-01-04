/**
 * GET /api/sections/:id - Get section details
 * PUT /api/sections/:id - Update section
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getNamespaceContext } from '@/server/auth/api-helpers';
import { getSectionRepository, getMembershipRepository } from '@/server/classes';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user } = auth;
    const namespaceId = getNamespaceContext(request, user);

    const sectionRepo = await getSectionRepository();
    const section = await sectionRepo.getSection(id, namespaceId);

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Get members
    const membershipRepo = await getMembershipRepository();
    const members = await membershipRepo.getSectionMembers(id);

    return NextResponse.json({ 
      section,
      members 
    });
  } catch (error) {
    console.error('[API] Get section error:', error);
    return NextResponse.json(
      { error: 'Failed to get section' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user } = auth;
    const namespaceId = getNamespaceContext(request, user);

    const sectionRepo = await getSectionRepository();
    const section = await sectionRepo.getSection(id, namespaceId);

    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Check if user is an instructor of this section
    if (!section.instructorIds.includes(user.id)) {
      return NextResponse.json(
        { error: 'Only section instructors can update it' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, semester } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (semester !== undefined) updates.semester = semester.trim();

    const updatedSection = await sectionRepo.updateSection(id, updates);

    return NextResponse.json({ section: updatedSection });
  } catch (error) {
    console.error('[API] Update section error:', error);
    return NextResponse.json(
      { error: 'Failed to update section' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  try {
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user } = auth;
    const namespaceId = getNamespaceContext(request, user);
    const { id } = await context.params;

    const sectionRepo = await getSectionRepository();
    const section = await sectionRepo.getSection(id, namespaceId);
    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Verify the user is an instructor for this section
    if (!section.instructorIds.includes(user.id)) {
      return NextResponse.json(
        { error: 'Only section instructors can delete it' },
        { status: 403 }
      );
    }

    await sectionRepo.deleteSection(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Delete section error:', error);
    return NextResponse.json(
      { error: 'Failed to delete section' },
      { status: 500 }
    );
  }
}
