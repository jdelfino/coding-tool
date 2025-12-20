/**
 * Admin API - Audit Log
 * GET /api/admin/audit
 * 
 * Returns audit log entries for role changes and other admin actions
 */

import { NextRequest, NextResponse } from 'next/server';
import { getAuthProvider } from '@/server/auth/instance';
import { LocalAuditLogRepository } from '@/server/auth/local/audit-log-repository';
import { AuditLogEntry } from '@/server/auth/audit';

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

    // Get query parameters
    const searchParams = request.nextUrl.searchParams;
    const action = searchParams.get('action');
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);

    // Get audit log entries
    const auditRepo = new LocalAuditLogRepository();
    const entries = await auditRepo.getEntries({
      action: action as AuditLogEntry['action'] | undefined,
      limit,
      offset,
    });

    const total = await auditRepo.getCount({
      action: action as AuditLogEntry['action'] | undefined,
    });

    return NextResponse.json({
      entries,
      pagination: {
        total,
        limit,
        offset,
        hasMore: offset + limit < total,
      },
    });
  } catch (error) {
    console.error('[Admin Audit API] Error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch audit log' },
      { status: 500 }
    );
  }
}
