/**
 * Admin API - Change User Role
 * PUT /api/admin/users/[id]/role
 * 
 * Allows admins to change user roles
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth/instance';
import { LocalAuditLogRepository } from '@/server/auth/local/audit-log-repository';
import type { UserRole } from '@/server/auth/types';

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Authenticate user
    const authProvider = await getAuthProvider();
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const actor = await (authProvider as any).getUserFromSession(sessionId);
    if (!actor) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Check admin permission
    if (actor.role !== 'admin') {
      return NextResponse.json(
        { error: 'Administrator privileges required' },
        { status: 403 }
      );
    }

    // Get target user
    const { id: targetId } = await params;
    const userRepo = (authProvider as any).userRepository;
    const target = await userRepo.getUser(targetId);

    if (!target) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    // Parse request body
    const body = await request.json();
    const newRole = body.role as UserRole;

    if (!newRole || !['admin', 'instructor', 'student'].includes(newRole)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be admin, instructor, or student' },
        { status: 400 }
      );
    }

    // Prevent self-demotion from admin
    if (actor.id === targetId && actor.role === 'admin' && newRole !== 'admin') {
      return NextResponse.json(
        { error: 'Cannot change your own admin role' },
        { status: 403 }
      );
    }

    // Check if this would leave no admins
    if (target.role === 'admin' && newRole !== 'admin') {
      const allUsers = await authProvider.getAllUsers();
      const adminCount = allUsers.filter(u => u.role === 'admin').length;
      
      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot demote the last admin. System must have at least one admin.' },
          { status: 403 }
        );
      }
    }

    // Store old role for audit
    const oldRole = target.role;

    // Update user role
    await userRepo.updateUser(targetId, { role: newRole });

    // Create audit log entry
    const auditRepo = new LocalAuditLogRepository();
    await auditRepo.createEntry({
      action: 'role_change',
      actorId: actor.id,
      actorUsername: actor.username,
      actorRole: actor.role,
      targetId: target.id,
      targetUsername: target.username,
      details: {
        action: 'role_change',
        oldRole,
        newRole,
      },
    });

    // Get updated user
    const updatedUser = await userRepo.getUser(targetId);

    return NextResponse.json({
      success: true,
      user: updatedUser,
      message: `User role changed from ${oldRole} to ${newRole}`,
    });
  } catch (error) {
    console.error('[Admin Role Change API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to change user role' },
      { status: 500 }
    );
  }
}
