/**
 * POST /api/sessions/[id]/feature
 * Feature a student's code for public display
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getAuthenticatedUser, checkPermission } from '@/server/auth/api-auth';
import { getStorage } from '@/server/persistence';
import * as SessionService from '@/server/services/session-service';
import { rateLimit } from '@/server/rate-limit';

/**
 * Send a broadcast message to notify clients of featured student changes.
 * Uses Broadcast instead of postgres_changes for reliability (recommended by Supabase).
 * Exported for testing.
 */
export function broadcastFeaturedStudentChange(
  sessionId: string,
  featuredStudentId: string | null,
  featuredCode: string | null
) {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SECRET_KEY;

  if (!supabaseUrl) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL is required for broadcast');
  }
  if (!supabaseKey) {
    throw new Error('SUPABASE_SECRET_KEY is required for broadcast');
  }

  const supabase = createClient(supabaseUrl, supabaseKey);
  const channel = supabase.channel(`session:${sessionId}`);

  // Fire and forget - don't await to avoid blocking the response
  channel.subscribe(async (status) => {
    if (status === 'SUBSCRIBED') {
      await channel.send({
        type: 'broadcast',
        event: 'featured_student_changed',
        payload: {
          sessionId,
          featuredStudentId,
          featuredCode,
          timestamp: Date.now(),
        },
      });
      supabase.removeChannel(channel);
    }
  });
}

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

    // Rate limit by user ID (write operation)
    const limited = await rateLimit('write', request, user.id);
    if (limited) return limited;

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

      // Broadcast the change to all connected clients (more reliable than postgres_changes)
      broadcastFeaturedStudentChange(sessionId, studentId, student.code || null);

      return NextResponse.json({
        success: true,
        featuredStudentId: studentId,
        featuredCode: student.code,
      });
    } else {
      // Clear featured submission via service
      await SessionService.clearFeaturedSubmission(storage, sessionId);

      // Broadcast the change to all connected clients
      broadcastFeaturedStudentChange(sessionId, null, null);

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
