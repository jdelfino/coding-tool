/**
 * POST /api/admin/clear-data
 * Clear all application data (for testing/development).
 * Requires admin permissions.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth';
import { getStorage } from '@/server/persistence';
import { getSessionManager } from '@/server/session-manager';
import { requirePermission } from '@/server/auth/api-helpers';

export async function POST(request: NextRequest) {
  try {
    // Check authentication and authorization - require admin or instructor
    // (Instructors can clear data for development/testing purposes)
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

    // Only admins and instructors can clear data
    if (session.user.role !== 'namespace-admin' && session.user.role !== 'instructor') {
      return NextResponse.json(
        { error: 'Forbidden: Only admins and instructors can clear data' },
        { status: 403 }
      );
    }

    const auth = { user: session.user };

    // Get storage backend and clear all data
    const storage = await getStorage();
    
    // Clear in dependency order:
    // 1. Sessions (depend on users, sections)
    // 2. Memberships (depend on users, sections)
    // 3. Sections (depend on classes)
    // 4. Classes (depend on users)
    // 5. Problems (depend on users)
    // 6. Auth sessions (depend on users)
    // 7. Users (last)
    
    // 1. Clear all active sessions via session manager
    const sessionManager = await getSessionManager();
    const allSessions = await storage.sessions.listAllSessions();
    for (const session of allSessions) {
      try {
        await sessionManager.endSession(session.id);
      } catch (error) {
        console.error(`[Admin Clear Data] Error ending session ${session.id}:`, error);
      }
    }
    
    // 2. Clear memberships
    if (storage.memberships) {
      const membershipRepo = storage.memberships as any;
      if (typeof membershipRepo.clear === 'function') {
        await membershipRepo.clear();
      }
    }
    
    // 3. Clear sections
    if (storage.sections) {
      const sectionRepo = storage.sections as any;
      if (typeof sectionRepo.clear === 'function') {
        await sectionRepo.clear();
      }
    }
    
    // 4. Clear classes
    if (storage.classes) {
      const classRepo = storage.classes as any;
      if (typeof classRepo.clear === 'function') {
        await classRepo.clear();
      }
    }
    
    // 5. Clear problems
    const problems = await storage.problems.getAll({});
    for (const problem of problems) {
      try {
        await storage.problems.delete(problem.id);
      } catch (error) {
        console.error(`[Admin Clear Data] Error deleting problem ${problem.id}:`, error);
      }
    }
    
    // 6. Clear revisions
    if (storage.revisions) {
      const revisionRepo = storage.revisions as any;
      if (typeof revisionRepo.clear === 'function') {
        await revisionRepo.clear();
      }
    }
    
    // 7. Clear auth sessions and users
    const users = await authProvider.getAllUsers();
    
    // Clear all auth sessions first
    const allAuthSessions = (authProvider as any).getActiveSessions?.() || [];
    for (const authSession of allAuthSessions) {
      await authProvider.destroySession(authSession.sessionId);
    }
    
    // Delete all users except the current admin/instructor (to prevent lockout)
    let deletedCount = 0;
    for (const user of users) {
      if (user.id !== session.user.id) {
        try {
          await authProvider.deleteUser(user.id);
          deletedCount++;
        } catch (error) {
          console.error(`[Admin Clear Data] Error deleting user ${user.id}:`, error);
        }
      }
    }
    
    return NextResponse.json({
      success: true,
      message: 'All data cleared successfully',
      preserved: {
        admin: {
          id: session.user.id,
          username: session.user.username,
        },
      },
    });
  } catch (error) {
    console.error('[Admin Clear Data] Error:', error);
    return NextResponse.json(
      { error: 'Failed to clear data', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
