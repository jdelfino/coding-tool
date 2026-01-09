/**
 * POST /api/sessions/[id]/execute
 * Execute student code and return result
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import { executeCodeSafe } from '@/server/code-executor';
import { ExecutionSettings } from '@/server/types/problem';
import * as SessionService from '@/server/services/session-service';

interface ExecuteCodeBody {
  studentId: string;
  code: string;
  executionSettings?: ExecutionSettings;
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
    const body: ExecuteCodeBody = await request.json();
    const { studentId, code, executionSettings: payloadSettings } = body;

    // Validate inputs
    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      );
    }

    if (!code || typeof code !== 'string') {
      return NextResponse.json(
        { error: 'Code is required' },
        { status: 400 }
      );
    }

    // Get session from storage
    const storage = await getStorage();
    const session = await storage.sessions.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // SECURITY: Block execution in closed sessions
    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'Session is closed. Code execution is no longer available.' },
        { status: 400 }
      );
    }

    // SECURITY: Verify user is session creator or participant
    const isCreator = session.creatorId === user.id;
    const isParticipant = session.participants.includes(user.id);
    if (!isCreator && !isParticipant) {
      return NextResponse.json(
        { error: 'Access denied. You are not a participant in this session.' },
        { status: 403 }
      );
    }

    // Get student data for their execution settings using service
    const studentData = SessionService.getStudentData(session, studentId);

    // Merge execution settings: payload (highest) → student → session (lowest)
    const effectiveSettings: ExecutionSettings = payloadSettings ||
      studentData?.executionSettings ||
      session.problem?.executionSettings ||
      {};

    // Execute code
    const result = await executeCodeSafe({
      code,
      executionSettings: effectiveSettings,
    });

    return NextResponse.json(result);
  } catch (error: unknown) {
    // Handle authentication errors
    if (error instanceof Error && error.message === 'Not authenticated') {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    // Handle other errors
    console.error('[API] Execute code error:', error);
    return NextResponse.json(
      { error: 'Failed to execute code' },
      { status: 500 }
    );
  }
}
