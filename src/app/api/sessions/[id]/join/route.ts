/**
 * POST /api/sessions/[id]/join
 * Student joins a session
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserWithToken } from '@/server/auth/api-auth';
import { createStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';
import { rateLimit } from '@/server/rate-limit';
import { SERVICE_ROLE_MARKER } from '@/server/supabase/client';
import { ExecutionSettings } from '@/server/types';
import { sendBroadcast } from '@/lib/supabase/broadcast';

/**
 * Send a broadcast message to notify clients when a student joins a session.
 * Uses Broadcast instead of postgres_changes for reliability (recommended by Supabase).
 * Exported for testing.
 */
export async function broadcastStudentJoined(
  sessionId: string,
  student: {
    userId: string;
    name: string;
    code: string | null;
    executionSettings: ExecutionSettings | undefined;
  }
): Promise<void> {
  return sendBroadcast({
    channel: `session:${sessionId}`,
    event: 'student_joined',
    payload: {
      sessionId,
      student,
      timestamp: Date.now(),
    },
  });
}

interface JoinSessionBody {
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
    const { user } = await getAuthenticatedUserWithToken(request);

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

    // CRITICAL FIX: Delete any stale student data from database BEFORE loading session
    // This prevents stale rows from previous sessions being loaded into session.students map
    // which would cause addStudent to preserve old code instead of using fresh starter code
    const { getSupabaseClientWithAuth, SERVICE_ROLE_MARKER } = await import('@/server/supabase/client');
    const supabase = getSupabaseClientWithAuth(SERVICE_ROLE_MARKER);
    await supabase
      .from('session_students')
      .delete()
      .eq('session_id', sessionId)
      .eq('user_id', user.id);

    // Use service role for session operations
    // RLS policies for session_students require complex permission checks
    // We've already verified user is authenticated, so use service role for the update
    const storage = await createStorage(SERVICE_ROLE_MARKER);

    // Now load the session - it will NOT have this student in the students map
    const session = await storage.sessions.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session not found' },
        { status: 404 }
      );
    }

    // Add student via service (handles starter code, participants, persistence)
    // Since we deleted the DB row above, this will be treated as a fresh join with starter code
    const student = await SessionService.addStudent(storage, session, user.id, name);

    // Get merged execution settings via service
    const studentData = SessionService.getStudentData(session, user.id);

    // Broadcast the student join event to all connected clients (more reliable than postgres_changes)
    await broadcastStudentJoined(sessionId, {
      userId: student.userId,
      name: student.name,
      code: student.code || null,
      executionSettings: studentData?.executionSettings,
    });

    // Return student information
    return NextResponse.json({
      success: true,
      student: {
        id: student.userId,
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
