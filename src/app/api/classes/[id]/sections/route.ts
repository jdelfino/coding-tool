/**
 * POST /api/classes/:id/sections - Create a new section in a class
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getClassRepository, getSectionRepository } from '@/server/classes';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classId } = await params;
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

    // Check instructor role
    if (session.user.role !== 'instructor') {
      return NextResponse.json(
        { error: 'Only instructors can create sections' },
        { status: 403 }
      );
    }

    const classRepo = getClassRepository();
    const classData = await classRepo.getClass(classId);

    if (!classData) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    const body = await request.json();
    const { name, semester } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Section name is required' },
        { status: 400 }
      );
    }

    const sectionRepo = getSectionRepository();
    const newSection = await sectionRepo.createSection({
      classId,
      name: name.trim(),
      semester: semester?.trim() || '',
      instructorIds: [session.user.id],
      active: true,
    });

    return NextResponse.json({ section: newSection }, { status: 201 });
  } catch (error) {
    console.error('[API] Create section error:', error);
    return NextResponse.json(
      { error: 'Failed to create section' },
      { status: 500 }
    );
  }
}
