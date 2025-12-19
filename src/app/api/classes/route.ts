/**
 * GET /api/classes - List instructor's classes
 * POST /api/classes - Create a new class
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getClassRepository } from '@/server/classes';

export async function GET(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const authProvider = await getAuthProvider();
    const session = await authProvider.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      );
    }

    // Get all classes where user is an instructor
    const classRepo = getClassRepository();
    const classes = await classRepo.listClasses(session.user.id);

    return NextResponse.json({ classes });
  } catch (error) {
    console.error('[API] Get classes error:', error);
    return NextResponse.json(
      { error: 'Failed to get classes' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Not authenticated' },
        { status: 401 }
      );
    }

    const authProvider = await getAuthProvider();
    const session = await authProvider.getSession(sessionId);

    if (!session) {
      return NextResponse.json(
        { error: 'Session expired' },
        { status: 401 }
      );
    }

    // Check instructor role
    if (session.user.role !== 'instructor') {
      return NextResponse.json(
        { error: 'Only instructors can create classes' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    if (!name || typeof name !== 'string') {
      return NextResponse.json(
        { error: 'Class name is required' },
        { status: 400 }
      );
    }

    const classRepo = getClassRepository();
    const newClass = await classRepo.createClass({
      name: name.trim(),
      description: description?.trim() || '',
      createdBy: session.user.id,
    });

    return NextResponse.json({ class: newClass }, { status: 201 });
  } catch (error) {
    console.error('[API] Create class error:', error);
    return NextResponse.json(
      { error: 'Failed to create class' },
      { status: 500 }
    );
  }
}
