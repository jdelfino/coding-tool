/**
 * Problem API endpoints
 * 
 * GET /api/problems - List all problems (with filters)
 * POST /api/problems - Create a new problem
 */

import { NextRequest, NextResponse } from 'next/server';
import { getStorage } from '@/server/persistence';
import { getAuthProvider } from '@/server/auth';
import type { ProblemInput } from '@/server/types/problem';

/**
 * GET /api/problems
 * 
 * List problems with optional filters
 * Query params:
 * - authorId: Filter by author
 * - classId: Filter by class
 * - includePublic: Include public problems (default: true)
 * - sortBy: Sort field (title, created, updated)
 * - sortOrder: Sort order (asc, desc)
 */
export async function GET(request: NextRequest) {
  try {
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

    const searchParams = request.nextUrl.searchParams;
    const authorId = searchParams.get('authorId') || undefined;
    const classId = searchParams.get('classId') || undefined;
    const includePublic = searchParams.get('includePublic') !== 'false';
    const sortBy = (searchParams.get('sortBy') || 'created') as 'title' | 'created' | 'updated';
    const sortOrder = (searchParams.get('sortOrder') || 'desc') as 'asc' | 'desc';

    const storage = await getStorage();
    const problems = await storage.problems.getAll({
      authorId,
      classId,
      includePublic,
      sortBy,
      sortOrder,
    });

    return NextResponse.json({ problems });
  } catch (error: any) {
    console.error('Error listing problems:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to list problems' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/problems
 * 
 * Create a new problem
 * Body: ProblemInput (title, description, starterCode, etc.)
 */
export async function POST(request: NextRequest) {
  try {
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

    const user = session.user;

    // Only instructors and admins can create problems
    if (user.role !== 'instructor' && user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Forbidden: Only instructors can create problems' },
        { status: 403 }
      );
    }

    const body = await request.json();

    // Construct problem input
    const problemInput: ProblemInput = {
      title: body.title,
      description: body.description || '',
      starterCode: body.starterCode || '',
      solutionCode: body.solutionCode || '',
      testCases: body.testCases || [],
      authorId: user.id,
      classId: body.classId || null,
    };

    const storage = await getStorage();
    const problem = await storage.problems.create(problemInput);

    return NextResponse.json({ problem }, { status: 201 });
  } catch (error: any) {
    console.error('Error creating problem:', error);
    
    // Handle validation errors
    if (error.code === 'INVALID_DATA') {
      return NextResponse.json(
        { error: error.message, details: error.details },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Failed to create problem' },
      { status: 500 }
    );
  }
}
