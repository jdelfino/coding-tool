/**
 * POST /api/sessions/[id]/join
 * Student joins a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getSessionManager } from '@/server/session-manager';

interface JoinSessionBody {
  studentId?: string;
  name: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);

    // Get session ID from params
    const { id: sessionId } = await params;

    // Parse request body
    const body: JoinSessionBody = await request.json();
    const { name } = body;

    // Validate name
    if (!name || typeof name !== 'string' || name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Student name is required' },
        { status: 400 }
      );
    }

    if (name.trim().length > 50) {
      return NextResponse.json(
        { error: 'Student name is too long (max 50 characters)' },
        { status: 400 }
      );
    }

    // Use provided studentId or default to authenticated user's ID
    const studentId = body.studentId || user.id;

    // Get session
    const sessionManager = getSessionManager();
    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Check if session is completed
    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'This session has ended and cannot be joined' },
        { status: 400 }
      );
    }

    // Check if student has existing code (rejoining)
    const studentData = await sessionManager.getStudentData(sessionId, studentId);

    // Add student to session
    const success = await sessionManager.addStudent(sessionId, studentId, name.trim());

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to join session' },
        { status: 500 }
      );
    }

    // Return student information
    return NextResponse.json({
      success: true,
      student: {
        id: studentId,
        name: name.trim(),
        code: studentData?.code || session.problem?.starterCode || '',
        executionSettings: studentData?.executionSettings,
      },
    });
  } catch (error: any) {
    // Handle authentication errors
    if (error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Handle other errors
    console.error('[API] Join session error:', error);
    return NextResponse.json(
      { error: 'Failed to join session' },
      { status: 500 }
    );
  }
}
