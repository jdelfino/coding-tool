/**
 * API Route: Execute Code (Instructor Preview)
 *
 * POST /api/execute
 * Executes Python code for instructors creating/editing problems.
 * Uses ephemeral execution - no session association.
 *
 * IMPORTANT: This endpoint is for instructors only.
 * For session-based execution, use /api/sessions/[id]/execute instead.
 *
 * Request body:
 * - code: string (required) - Python code to execute
 * - stdin?: string - Standard input for the program
 * - randomSeed?: number - Random seed for deterministic execution
 * - attachedFiles?: Array<{name: string, content: string}> - Files to make available
 * - timeout?: number - Execution timeout in milliseconds (default: 10000, max: 30000)
 *
 * Returns:
 * - success: boolean
 * - output: string
 * - error: string
 * - executionTime: number
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUserWithToken } from '@/server/auth/api-auth';
import { validateCodeSize, validateStdinSize } from '@/server/code-execution/utils';
import { executeEphemeral } from '@/server/code-execution/ephemeral-execute';
import { rateLimit } from '@/server/rate-limit';

export async function POST(request: NextRequest) {
  // Authenticate user
  let user;
  try {
    const auth = await getAuthenticatedUserWithToken(request);
    user = auth.user;
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Restrict to instructors only
  if (user.role !== 'instructor' &&
      user.role !== 'namespace-admin' &&
      user.role !== 'system-admin') {
    return NextResponse.json(
      { error: 'Forbidden: Only instructors can use this endpoint' },
      { status: 403 }
    );
  }

  // Rate limit
  const limited = await rateLimit('execute', request, user.id);
  if (limited) return limited;

  // Parse request body
  const body = await request.json();
  const { code, stdin, randomSeed, attachedFiles, timeout: requestedTimeout } = body;

  // Validate required fields
  if (!code || typeof code !== 'string') {
    return NextResponse.json(
      { error: 'Code is required and must be a string' },
      { status: 400 }
    );
  }

  // Validate input sizes
  try {
    validateCodeSize(code);
    validateStdinSize(stdin);
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }

  try {
    const result = await executeEphemeral(
      { code, executionSettings: { stdin, randomSeed, attachedFiles } },
      requestedTimeout
    );

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error('Code execution error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
