/**
 * Admin API - System Statistics
 * GET /api/admin/stats
 * 
 * Returns system-wide statistics for the admin dashboard
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth/instance';
import { getSectionRepository } from '@/server/classes';
import { getMembershipRepository } from '@/server/classes';
import { getSessionManager } from '@/server/session-manager';

export async function GET(request: NextRequest) {
  try {
    // Authenticate user
    const authProvider = await getAuthProvider();
    const sessionId = request.cookies.get('sessionId')?.value;

    if (!sessionId) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const user = await authProvider.getUserFromSession(sessionId);
    if (!user) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    // Check admin permission
    if (user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Administrator privileges required' },
        { status: 403 }
      );
    }

    // Get repositories
    const sectionRepo = await getSectionRepository();
    const membershipRepo = await getMembershipRepository();
    const sessionManager = getSessionManager();

    // Get all users
    const users = await authProvider.getAllUsers();
    const usersByRole = users.reduce((acc: Record<string, number>, u) => {
      acc[u.role] = (acc[u.role] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // Get all sections (to count classes from unique classIds)
    const allSections = await sectionRepo.listSections();
    const uniqueClassIds = new Set(allSections.map(s => s.classId));
    
    // Get session count
    const sessionCount = await sessionManager.getSessionCount();

    const stats = {
      users: {
        total: users.length,
        byRole: {
          admin: usersByRole.admin || 0,
          instructor: usersByRole.instructor || 0,
          student: usersByRole.student || 0,
        },
      },
      classes: {
        total: uniqueClassIds.size,
      },
      sections: {
        total: allSections.length,
      },
      sessions: {
        active: sessionCount,
      },
    };

    return NextResponse.json(stats);
  } catch (error) {
    console.error('[Admin Stats API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch system statistics' },
      { status: 500 }
    );
  }
}
