/**
 * POST /api/sessions/[id]/code
 * Save student code to session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getSessionManager } from '@/server/session-manager';
import { revisionBufferHolder } from '@/server/revision-buffer';
import { ExecutionSettings } from '@/server/types/problem';

interface SaveCodeBody {
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
    const body: SaveCodeBody = await request.json();
    const { studentId, code, executionSettings } = body;

    // Validate inputs
    if (!studentId || typeof studentId !== 'string') {
      return NextResponse.json(
        { error: 'Student ID is required' },
        { status: 400 }
      );
    }

    if (code === undefined || code === null || typeof code !== 'string') {
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

    // Update student code
    const success = await sessionManager.updateStudentCode(sessionId, studentId, code);

    if (!success) {
      return NextResponse.json(
        { error: 'Failed to save code' },
        { status: 500 }
      );
    }

    // Update execution settings if provided
    if (executionSettings) {
      await sessionManager.updateStudentSettings(sessionId, studentId, executionSettings);
    }

    // Track revision using revision buffer (for batched persistence)
    if (revisionBufferHolder.instance) {
      await revisionBufferHolder.instance.addRevision(
        sessionId,
        studentId,
        code,
        session.namespaceId
      );
    }

    return NextResponse.json({
      success: true,
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
    console.error('[API] Save code error:', error);
    return NextResponse.json(
      { error: 'Failed to save code' },
      { status: 500 }
    );
  }
}
