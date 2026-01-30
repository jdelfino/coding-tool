/**
 * Public problem API endpoint (unauthenticated)
 *
 * GET /api/problems/[id]/public - Get public problem fields without auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { createStorage } from '@/server/persistence';

type Params = {
  params: Promise<{
    id: string;
  }>;
};

/**
 * GET /api/problems/[id]/public
 *
 * Returns only public-safe fields: id, title, description, solution.
 * No authentication required.
 */
export async function GET(
  request: NextRequest,
  { params }: Params
) {
  try {
    const { id } = await params;

    // Use service-level access (no user token needed for public read)
    const storage = await createStorage(process.env.SUPABASE_SECRET_KEY!);
    const problem = await storage.problems.getById(id);

    if (!problem) {
      return NextResponse.json(
        { error: 'Problem not found' },
        { status: 404 }
      );
    }

    // Return only public fields
    return NextResponse.json({
      id: problem.id,
      title: problem.title,
      description: problem.description,
      solution: problem.solution,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to get problem';
    console.error('Error getting public problem:', error);
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
