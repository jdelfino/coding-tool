/**
 * GET /api/sections/:id - Get section details
 * PUT /api/sections/:id - Update section
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getSectionRepository, getMembershipRepository } from '@/server/classes';

export async function GET(
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

    const sectionRepo = await getSectionRepository();
    const section = await sectionRepo.getSection(id);

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

    const sectionRepo = await getSectionRepository();
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
    const session = await auth();
    if (!session?.user?.id) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const userId = session.user.id;
    const { id } = await context.params;

    const section = await sectionRepo.getSection(id);
    if (!section) {
      return NextResponse.json(
        { error: 'Section not found' },
        { status: 404 }
      );
    }

    // Verify the user is an instructor for this section
    if (!section.instructorIds.includes(userId)) {
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
