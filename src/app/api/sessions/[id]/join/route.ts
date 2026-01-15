/**
 * POST /api/sessions/[id]/join
 * Student joins a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';
import { rateLimit } from '@/server/rate-limit';

interface JoinSessionBody {
  studentId?: string;
  name: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Rate limit by IP to prevent join abuse
  const limited = await rateLimit('join', request);
  if (limited) return limited;

  try {
    // Authenticate user
    const user = await getAuthenticatedUser(request);

    // Get session ID from params
    const { id: sessionId } = await params;

    // Parse request body
    const body: JoinSessionBody = await request.json();
    const { name } = body;

    // Validate name (HTTP-level validation)
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
    const storage = await getStorage();
    const session = await storage.sessions.getSession(sessionId);

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

    // Add student via service (handles starter code, participants, persistence)
    const student = await SessionService.addStudent(storage, session, studentId, name);

    // Get merged execution settings via service
    const studentData = SessionService.getStudentData(session, studentId);

    // Return student information
    return NextResponse.json({
      success: true,
      student: {
        id: student.id,
        name: student.name,
        code: student.code,
        executionSettings: studentData?.executionSettings,
      },
    });
  } catch (error: unknown) {
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Not authenticated') {
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
