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
import { executeCode } from '@/server/code-executor';
import { getAuthProvider } from '@/server/auth';

export async function POST(request: NextRequest) {
  try {
    // Verify user is authenticated
    const sessionId = request.cookies.get('sessionId')?.value;
    if (!sessionId) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const authProvider = await getAuthProvider();
    const session = await authProvider.getSession(sessionId);
    if (!session) {
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

    // Execute code
    const result = await executeCode(
      {
        code,
        stdin,
        randomSeed,
        attachedFiles,
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
