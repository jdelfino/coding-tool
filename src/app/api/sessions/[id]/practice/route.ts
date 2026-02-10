/**
 * API Route: Practice Mode Code Execution
 *
 * POST /api/sessions/[id]/practice
 * Executes Python code for students practicing in completed sessions.
 * Uses ephemeral sandboxes - no persistent state.
 *
 * Request body:
 * - code: string (required) - Python code to execute
 * - executionSettings?: ExecutionSettings - Optional settings override
 *
 * Returns:
 * - success: boolean
 * - output: string
 * - error: string
 * - executionTime: number
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserWithToken } from '@/server/auth/api-auth';
import { createStorage } from '@/server/persistence';
import { executeEphemeral } from '@/server/code-execution/ephemeral-execute';
import { validateCodeSize, validateStdinSize } from '@/server/code-execution/utils';
import { rateLimit } from '@/server/rate-limit';
import { ExecutionSettings } from '@/server/types/problem';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  // Authenticate user
  let user;
  let accessToken: string;
  try {
    const auth = await getAuthenticatedUserWithToken(request);
    user = auth.user;
    accessToken = auth.accessToken;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Parse request body
  const body = await request.json();
  const { code, executionSettings: payloadSettings } = body;

  // Validate required fields
  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Code is required' }, { status: 400 });
  }

  // Validate input sizes
  try {
    validateCodeSize(code);
    if (payloadSettings?.stdin) {
      validateStdinSize(payloadSettings.stdin);
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  // Rate limit
  const limited = await rateLimit('practice', request, user.id);
  if (limited) return limited;

  // Get session
  const { id: sessionId } = await params;
  const storage = await createStorage(accessToken);
  const session = await storage.sessions.getSession(sessionId);

  if (!session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 });
  }

  // Practice mode only available for completed sessions
  if (session.status !== 'completed') {
    return NextResponse.json(
      { error: 'Practice mode is only available for completed sessions' },
      { status: 400 }
    );
  }

  // Security: user must be a participant or the session creator
  const isParticipant = session.participants.includes(user.id);
  const isCreator = session.creatorId === user.id;

  if (!isParticipant && !isCreator) {
    return NextResponse.json(
      { error: 'Access denied. You are not a participant in this session.' },
      { status: 403 }
    );
  }

  // Determine execution settings:
  // 1. Payload settings (highest priority)
  // 2. Problem execution settings
  // 3. Empty object (fallback)
  const executionSettings: ExecutionSettings =
    payloadSettings || session.problem?.executionSettings || {};

  try {
    const result = await executeEphemeral(
      {
        code,
        executionSettings,
      },
      undefined
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Practice mode execution error:', error);
    return NextResponse.json(
      { error: 'Failed to execute code' },
      { status: 500 }
    );
  }
}
