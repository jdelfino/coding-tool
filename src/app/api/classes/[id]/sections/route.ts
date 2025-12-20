/**
 * GET /api/classes/:id/sections - Get all sections for a class
 * POST /api/classes/:id/sections - Create a new section in a class
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getClassRepository, getSectionRepository, getMembershipRepository } from '@/server/classes';

export async function GET(
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

    // Verify class exists
    const classRepo = await getClassRepository();
    const classData = await classRepo.getClass(classId);

    if (!classData) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Get sections for this class
    const sectionRepo = await getSectionRepository();
    const allSections = await sectionRepo.listSections();
    const classSections = allSections.filter(s => s.classId === classId);

    // For instructors, add student count and active session count
    if (session.user.role === 'instructor') {
      const membershipRepo = await getMembershipRepository();
      const sectionsWithCounts = await Promise.all(
        classSections.map(async (section) => {
          const students = await membershipRepo.getSectionMembers(section.id, 'student');
          const studentCount = students.length;
          
          // TODO: Add active session count when we have a way to query sessions by section
          return {
            id: section.id,
            name: section.name,
            schedule: section.semester, // Using semester field as schedule
            location: '', // Not stored yet
            studentCount,
            activeSessionCount: 0,
          };
        })
      );
      return NextResponse.json({ sections: sectionsWithCounts });
    }

    // For students, just return basic section info
    return NextResponse.json({ 
      sections: classSections.map(s => ({
        id: s.id,
        name: s.name,
        schedule: s.semester,
      }))
    });
  } catch (error) {
    console.error('[API] Get sections error:', error);
    return NextResponse.json(
      { error: 'Failed to load sections' },
      { status: 500 }
    );
  }
}

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

    const classRepo = await getClassRepository();
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

    const sectionRepo = await getSectionRepository();
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
