/**
 * GET /api/classes/:id - Get class details
 * PUT /api/classes/:id - Update class
 * DELETE /api/classes/:id - Delete class
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getClassRepository, getSectionRepository } from '@/server/classes';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const classRepo = getClassRepository();
    const classData = await classRepo.getClass(id);

    if (!classData) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Get sections for this class
    const sections = await classRepo.getClassSections(id);

    return NextResponse.json({ 
      class: classData,
      sections 
    });
  } catch (error) {
    console.error('[API] Get class error:', error);
    return NextResponse.json(
      { error: 'Failed to get class' },
      { status: 500 }
    );
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const classRepo = getClassRepository();
    const classData = await classRepo.getClass(id);

    if (!classData) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (classData.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the class creator can update it' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { name, description } = body;

    const updates: any = {};
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description.trim();

    const updatedClass = await classRepo.updateClass(id, updates);

    return NextResponse.json({ class: updatedClass });
  } catch (error) {
    console.error('[API] Update class error:', error);
    return NextResponse.json(
      { error: 'Failed to update class' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
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

    const classRepo = getClassRepository();
    const classData = await classRepo.getClass(id);

    if (!classData) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (classData.createdBy !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the class creator can delete it' },
        { status: 403 }
      );
    }

    // Check if class has sections
    const sections = await classRepo.getClassSections(id);

    if (sections.length > 0) {
      return NextResponse.json(
        { error: 'Cannot delete class with existing sections. Delete sections first.' },
        { status: 400 }
      );
    }

    await classRepo.deleteClass(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('[API] Delete class error:', error);
    return NextResponse.json(
      { error: 'Failed to delete class' },
      { status: 500 }
    );
  }
}
