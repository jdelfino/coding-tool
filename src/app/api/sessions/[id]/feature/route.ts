/**
 * POST /api/sessions/[id]/feature
 * Feature a student's code for public display
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser, checkPermission } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';

interface FeatureStudentBody {
  studentId?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);

    // Check permission to feature students (requires session.viewAll)
    if (!checkPermission(user, 'session.viewAll')) {
      return NextResponse.json(
        { error: 'You do not have permission to feature students' },
        { status: 403 }
      );
    }

    // Get session ID from params
    const { id: sessionId } = await params;

    // Parse request body
    const body: FeatureStudentBody = await request.json();
    const { studentId } = body;

    // Get session
    const storage = await getStorage();
    const session = await storage.sessions.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // If studentId is provided, feature that student
    if (studentId) {
      // Check if student exists in session
      const student = session.students.get(studentId);
      if (!student) {
        return NextResponse.json(
          { error: 'Student not found in session' },
          { status: 404 }
        );
      }

      // Set featured submission via service
      await SessionService.setFeaturedSubmission(storage, session, studentId);

      return NextResponse.json({
        success: true,
        featuredStudentId: studentId,
        featuredCode: student.code,
      });
    } else {
      // Clear featured submission via service
      await SessionService.clearFeaturedSubmission(storage, sessionId);

      return NextResponse.json({
        success: true,
      });
    }
  } catch (error: unknown) {
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Handle other errors
    console.error('[API] Feature student error:', error);
    return NextResponse.json(
      { error: 'Failed to feature student' },
      { status: 500 }
    );
  }
}
