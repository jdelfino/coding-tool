/**
 * GET /api/classes/:id/sections - Get all sections for a class
 * POST /api/classes/:id/sections - Create a new section in a class
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getClassRepository, getSectionRepository, getMembershipRepository } from '@/server/classes';
import { requireAuth, requirePermission } from '@/server/auth/api-helpers';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: classId } = await params;
    
    // Check authentication
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
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

    // For users with viewAll permission, add student count and active session count
    if (auth.rbac.hasPermission(auth.user, 'session.viewAll')) {
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
    
    // Check authentication and authorization
    const auth = await requirePermission(request, 'session.create');
    if (auth instanceof NextResponse) {
      return auth; // Return 401/403 error response
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
      instructorIds: [auth.user.id],
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
