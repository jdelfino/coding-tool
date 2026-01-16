/**
 * GET /api/classes/:id - Get class details
 * PUT /api/classes/:id - Update class
 * DELETE /api/classes/:id - Delete class
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth, getNamespaceContext } from '@/server/auth/api-helpers';
import { getClassRepository } from '@/server/classes';
import { rateLimit } from '@/server/rate-limit';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user } = auth;

    // Rate limit by user ID (read operation)
    const limited = await rateLimit('read', request, user.id);
    if (limited) return limited;

    const namespaceId = getNamespaceContext(request, user);

    const classRepo = await getClassRepository();
    const classData = await classRepo.getClass(id, namespaceId);

    if (!classData) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Get sections for this class
    const sections = await classRepo.getClassSections(id, namespaceId);

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
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user } = auth;

    // Rate limit by user ID (write operation)
    const limited = await rateLimit('write', request, user.id);
    if (limited) return limited;
    const namespaceId = getNamespaceContext(request, user);

    const classRepo = await getClassRepository();
    const classData = await classRepo.getClass(id, namespaceId);

    if (!classData) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (classData.createdBy !== user.id) {
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
    const auth = await requireAuth(request);
    if (auth instanceof NextResponse) {
      return auth; // Return 401 error response
    }

    const { user } = auth;

    // Rate limit by user ID (write operation)
    const limited = await rateLimit('write', request, user.id);
    if (limited) return limited;
    const namespaceId = getNamespaceContext(request, user);

    const classRepo = await getClassRepository();
    const classData = await classRepo.getClass(id, namespaceId);

    if (!classData) {
      return NextResponse.json(
        { error: 'Class not found' },
        { status: 404 }
      );
    }

    // Check if user is the creator
    if (classData.createdBy !== user.id) {
      return NextResponse.json(
        { error: 'Only the class creator can delete it' },
        { status: 403 }
      );
    }

    // Check if class has sections
    const sections = await classRepo.getClassSections(id, namespaceId);

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
