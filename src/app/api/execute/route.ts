/**
 * API Route: Execute Code
 * 
 * POST /api/execute
 * Executes Python code and returns the results.
 * Used by instructors to test problem code without requiring a WebSocket connection.
 * 
 * Request body:
 * - code: string (required) - Python code to execute
 * - stdin?: string - Standard input for the program
 * - randomSeed?: number - Random seed for deterministic execution
 * - attachedFiles?: Array<{name: string, content: string}> - Files to make available during execution
 * - timeout?: number - Execution timeout in milliseconds (default: 10000)
 * 
 * Returns:
 * - success: boolean
 * - output: string
 * - error: string
 * - executionTime: number
 */

import { NextRequest, NextResponse } from 'next/server';
import { getExecutorService } from '@/server/code-execution';
import { getAuthProvider } from '@/server/auth';
import { validateCodeSize, validateStdinSize } from '@/server/code-execution/utils';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated using Supabase session
    const authProvider = await getAuthProvider();
    const session = await authProvider.getSessionFromRequest(request);
    if (!session || !session.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { code, stdin, randomSeed, attachedFiles, timeout } = body;

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
      return NextResponse.json(
        { error: (e as Error).message },
        { status: 400 }
      );
    }

    // Execute code (no sessionId - standalone execution uses default backend)
    const result = await getExecutorService().executeCode(
      {
        code,
        executionSettings: {
          stdin,
          randomSeed,
          attachedFiles,
        },
      },
      timeout
    );

    return NextResponse.json(result);
  } catch (error: any) {
    console.error('Code execution error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}
