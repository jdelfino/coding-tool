/**
 * POST /api/sessions/[id]/code
 * Save student code to session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import { getRevisionBuffer } from '@/server/revision-buffer';
import * as SessionService from '@/server/services/session-service';
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
    await getAuthenticatedUser(request);

    // Get session ID from params
    const { id: sessionId } = await params;

    // Parse request body
    const body: SaveCodeBody = await request.json();
    const { studentId, code, executionSettings } = body;

    // Validate inputs (HTTP-level validation)
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
    const storage = await getStorage();
    const session = await storage.sessions.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // SECURITY: Block code saving in closed sessions
    if (session.status === 'completed') {
      return NextResponse.json(
        { error: 'Session is closed. Code execution is no longer available.' },
        { status: 400 }
      );
    }

    // Verify student exists in session
    if (!session.students.has(studentId)) {
      return NextResponse.json(
        { error: 'Student not found in session' },
        { status: 404 }
      );
    }

    // Update student code via service
    await SessionService.updateStudentCode(
      storage,
      session,
      studentId,
      code,
      executionSettings
    );

    // Track revision using revision buffer (for batched persistence)
    const revisionBuffer = await getRevisionBuffer();
    await revisionBuffer.addRevision(
      sessionId,
      studentId,
      code,
      session.namespaceId
    );

    return NextResponse.json({
      success: true,
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
    console.error('[API] Save code error:', error);
    return NextResponse.json(
      { error: 'Failed to save code' },
      { status: 500 }
    );
  }
}
