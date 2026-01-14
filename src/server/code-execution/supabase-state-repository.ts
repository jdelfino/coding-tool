/**
 * Supabase Backend State Repository
 *
 * Implements IBackendStateRepository using Supabase's session_sandboxes table.
 * Provides persistence for backend assignments and state across serverless invocations.
 *
 * Uses the existing session_sandboxes table:
 * - session_id: Session ID (primary key)
 * - sandbox_id: Stores backend-specific identifier (e.g., Vercel sandbox ID)
 *
 * For backward compatibility:
 * - getAssignedBackend returns 'vercel-sandbox' if a row exists (legacy behavior)
 * - Future versions may add a backend_type column for explicit tracking
 */

import { getSupabaseClient } from '../supabase/client';
import { IBackendStateRepository } from './interfaces';

/**
 * Default backend type for existing rows (backward compatibility)
 */
const DEFAULT_BACKEND_TYPE = 'vercel-sandbox';

/**
 * Supabase-based implementation of IBackendStateRepository
 *
 * Uses session_sandboxes table to persist backend state.
 */
export class SupabaseBackendStateRepository implements IBackendStateRepository {
  /**
   * Assign a backend type to a session
   *
   * Creates or updates the session_sandboxes row for the session.
   * For now, backend_type is implicit (row existence = vercel-sandbox).
   *
   * @param sessionId - Session ID
   * @param backendType - Backend type identifier (stored implicitly for now)
   */
  async assignBackend(sessionId: string, backendType: string): Promise<void> {
    const supabase = getSupabaseClient();

    // Upsert a row to mark this session as using a backend
    // For now we don't have a backend_type column, so we use sandbox_id as placeholder
    // The presence of the row indicates the session has an assigned backend
    const { error } = await supabase
      .from('session_sandboxes')
      .upsert({
        session_id: sessionId,
        // Use backendType as initial sandbox_id marker (will be overwritten by saveState)
        sandbox_id: `pending-${backendType}`,
      }, {
        onConflict: 'session_id',
      });

    if (error) {
      throw new Error(`Failed to assign backend: ${error.message}`);
    }
  }

  /**
   * Get the assigned backend type for a session
   *
   * Returns 'vercel-sandbox' if a row exists (backward compatibility).
   * Future versions may store explicit backend_type.
   *
   * @param sessionId - Session ID
   * @returns Backend type or null if not assigned
   */
  async getAssignedBackend(sessionId: string): Promise<string | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('session_sandboxes')
      .select('session_id')
      .eq('session_id', sessionId)
      .single();

    // PGRST116 = not found, which is expected when no assignment exists
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get assigned backend: ${error.message}`);
    }

    // If row exists, return default backend type (backward compatibility)
    return data ? DEFAULT_BACKEND_TYPE : null;
  }

  /**
   * Save backend-specific state for a session
   *
   * Stores state.sandboxId as the sandbox_id column.
   *
   * @param sessionId - Session ID
   * @param state - Backend-specific state object (expects { sandboxId: string })
   */
  async saveState(sessionId: string, state: Record<string, unknown>): Promise<void> {
    const supabase = getSupabaseClient();

    const sandboxId = state.sandboxId as string;
    if (!sandboxId) {
      throw new Error('saveState requires state.sandboxId');
    }

    const { error } = await supabase
      .from('session_sandboxes')
      .upsert({
        session_id: sessionId,
        sandbox_id: sandboxId,
      }, {
        onConflict: 'session_id',
      });

    if (error) {
      throw new Error(`Failed to save state: ${error.message}`);
    }
  }

  /**
   * Get backend-specific state for a session
   *
   * Returns { sandboxId: data.sandbox_id } if found.
   *
   * @param sessionId - Session ID
   * @returns State object or null if not found
   */
  async getState(sessionId: string): Promise<Record<string, unknown> | null> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('session_sandboxes')
      .select('sandbox_id')
      .eq('session_id', sessionId)
      .single();

    // PGRST116 = not found
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to get state: ${error.message}`);
    }

    if (!data) {
      return null;
    }

    return { sandboxId: data.sandbox_id };
  }

  /**
   * Delete backend state for a session
   *
   * Removes the session_sandboxes row.
   *
   * @param sessionId - Session ID
   */
  async deleteState(sessionId: string): Promise<void> {
    const supabase = getSupabaseClient();

    const { error } = await supabase
      .from('session_sandboxes')
      .delete()
      .eq('session_id', sessionId);

    if (error) {
      throw new Error(`Failed to delete state: ${error.message}`);
    }
  }

  /**
   * Check if state exists for a session
   *
   * @param sessionId - Session ID
   * @returns true if state exists
   */
  async hasState(sessionId: string): Promise<boolean> {
    const supabase = getSupabaseClient();

    const { data, error } = await supabase
      .from('session_sandboxes')
      .select('session_id')
      .eq('session_id', sessionId)
      .single();

    // PGRST116 = not found, which means no state
    if (error && error.code !== 'PGRST116') {
      throw new Error(`Failed to check state: ${error.message}`);
    }

    return data !== null;
  }
}
