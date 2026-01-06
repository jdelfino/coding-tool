/**
 * POST /api/sessions/[id]/execute
 * Execute student code and return result
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getSessionManager } from '@/server/session-manager';
import { executeCodeSafe } from '@/server/code-executor';
import { ExecutionSettings } from '@/server/types/problem';

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

    // Get session
    const sessionManager = getSessionManager();
    const session = await sessionManager.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Get student data for their execution settings
    const studentData = await sessionManager.getStudentData(sessionId, studentId);

    // Merge execution settings: payload (highest) → student → session (lowest)
    const effectiveSettings: ExecutionSettings = payloadSettings ||
      studentData?.executionSettings ||
      session.problem.executionSettings ||
      {};

    // Execute code
    const result = await executeCodeSafe({
      code,
      executionSettings: effectiveSettings,
    });

    return NextResponse.json(result);
  } catch (error: any) {
    // Handle authentication errors
    if (error.message === 'Not authenticated') {
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
