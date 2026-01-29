'use client';

/**
 * Instructor Session Page
 *
 * Direct route for viewing an active session.
 * URL pattern: /instructor/session/{sessionId}
 *
 * Uses:
 * - SessionView component for the main UI
 * - useRealtimeSession hook for live data
 * - useSessionOperations hook for API calls
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRealtimeSession } from '@/hooks/useRealtimeSession';
import { useSessionOperations } from '@/hooks/useSessionOperations';
import { useAuth } from '@/contexts/AuthContext';
import { SessionView } from '../../components/SessionView';
import { ErrorAlert } from '@/components/ErrorAlert';
import { Spinner } from '@/components/ui/Spinner';
import { Problem, ExecutionSettings } from '@/server/types/problem';
import { ConnectionStatus } from '@/components/ConnectionStatus';
import { useHeaderSlot } from '@/contexts/HeaderSlotContext';

/**
 * Extended session state from API that includes joinCode from section
 */
interface SessionStateFromAPI {
  sectionId?: string;
  sectionName?: string;
  joinCode?: string;
  problem?: Problem | null;
  status?: 'active' | 'completed';
  featuredStudentId?: string | null;
}

export default function InstructorSessionPage() {
  const params = useParams();
  const router = useRouter();
  const { user, isLoading: authLoading } = useAuth();
  const { setHeaderSlot } = useHeaderSlot();
  const sessionId = params.id as string;

  // Local state
  const [error, setError] = useState<string | null>(null);
  const [sessionProblem, setSessionProblem] = useState<Problem | null>(null);
  const [sessionExecutionSettings, setSessionExecutionSettings] = useState<{
    stdin?: string;
    randomSeed?: number;
    attachedFiles?: Array<{ name: string; content: string }>;
  }>({});

  // Realtime session hook
  const {
    session: realtimeSessionRaw,
    students: realtimeStudents,
    loading: sessionLoading,
    error: sessionError,
    connectionStatus,
    connectionError,
    executeCode,
    featureStudent,
    clearFeaturedStudent,
  } = useRealtimeSession({
    sessionId: sessionId || '',
    userId: user?.id,
    userName: user?.displayName || user?.email,
  });

  // Cast session to include additional API fields like joinCode
  const realtimeSession = realtimeSessionRaw as SessionStateFromAPI | null;

  // Session operations hook
  const {
    endSession: apiEndSession,
    updateProblem: apiUpdateProblem,
  } = useSessionOperations();

  // Derive students array from realtime data (map userId to id for UI components)
  const students = useMemo(() =>
    realtimeStudents.map(s => ({
      id: s.userId,
      name: s.name,
      hasCode: !!s.code,
      executionSettings: {
        randomSeed: s.executionSettings?.randomSeed,
        stdin: s.executionSettings?.stdin,
        attachedFiles: s.executionSettings?.attachedFiles,
      },
    })),
    [realtimeStudents]
  );

  // Map userId to id for UI component compatibility
  const mappedRealtimeStudents = useMemo(() =>
    realtimeStudents.map(s => ({
      id: s.userId,
      name: s.name,
      code: s.code,
      executionSettings: s.executionSettings,
    })),
    [realtimeStudents]
  );

  // Session context for display (section info)
  const sessionContext = useMemo(() => {
    if (!realtimeSession) return null;
    return {
      sectionId: realtimeSession.sectionId || '',
      sectionName: realtimeSession.sectionName || 'Session',
    };
  }, [realtimeSession]);

  // Join code from session
  const joinCode = realtimeSession?.joinCode || null;

  // Sync state from Realtime session
  useEffect(() => {
    if (!realtimeSession) return;
    setSessionProblem(realtimeSession.problem || null);
    setSessionExecutionSettings(realtimeSession.problem?.executionSettings || {});
  }, [realtimeSession]);

  // Show connection status in the global header
  useEffect(() => {
    if (!sessionLoading) {
      setHeaderSlot(
        <ConnectionStatus
          status={connectionStatus}
          error={connectionError}
          variant="badge"
        />
      );
    }
    return () => setHeaderSlot(null);
  }, [sessionLoading, connectionStatus, connectionError, setHeaderSlot]);

  // Handle session ended state - status is 'active' or 'completed', not 'ended'
  const isSessionEnded = realtimeSession?.status === 'completed';

  // Handlers
  const handleEndSession = useCallback(async () => {
    if (!sessionId) return;

    try {
      await apiEndSession(sessionId);
      router.push('/instructor');
    } catch (err: any) {
      setError(err.message || 'Failed to end session');
    }
  }, [sessionId, apiEndSession, router]);

  const handleUpdateProblem = useCallback(async (
    problem: { title: string; description: string; starterCode: string },
    executionSettings?: {
      stdin?: string;
      randomSeed?: number;
      attachedFiles?: Array<{ name: string; content: string }>;
    }
  ) => {
    if (!sessionId) return;

    try {
      await apiUpdateProblem(sessionId, problem, executionSettings);
    } catch (err: any) {
      setError(err.message || 'Failed to update problem');
    }
  }, [sessionId, apiUpdateProblem]);

  const handleFeatureStudent = useCallback(async (studentId: string) => {
    if (!sessionId) return;

    try {
      await featureStudent(studentId);
    } catch (err: any) {
      setError(err.message || 'Failed to feature student');
    }
  }, [sessionId, featureStudent]);

  const handleClearPublicView = useCallback(async () => {
    if (!sessionId) return;

    try {
      await clearFeaturedStudent();
    } catch (err: any) {
      setError(err.message || 'Failed to clear public view');
    }
  }, [sessionId, clearFeaturedStudent]);

  const handleExecuteCode = useCallback(async (
    studentId: string,
    code: string,
    executionSettings: ExecutionSettings
  ) => {
    return executeCode(studentId, code, executionSettings);
  }, [executeCode]);

  // Loading state
  if (authLoading || sessionLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="loading-state">
        <div className="text-center">
          <Spinner size="lg" />
          <p className="mt-4 text-gray-600">Loading session...</p>
        </div>
      </div>
    );
  }

  // Session not found (after loading)
  if (!sessionLoading && !realtimeSession && sessionError) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="error-state">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-red-50 border border-red-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-red-900 mb-2">Session Not Found</h2>
            <p className="text-red-700 mb-4">{sessionError}</p>
            <button
              onClick={() => router.push('/instructor')}
              className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700 transition-colors"
            >
              Back to Sessions
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Session ended state
  if (isSessionEnded) {
    return (
      <div className="min-h-screen flex items-center justify-center" data-testid="session-ended-state">
        <div className="max-w-md mx-auto text-center">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-900 mb-2">Session Ended</h2>
            <p className="text-yellow-700 mb-4">
              This session has ended and is no longer active.
            </p>
            <button
              onClick={() => router.push('/instructor')}
              className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700 transition-colors"
            >
              Back to Sessions
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Errors */}
      {connectionError && (
        <ErrorAlert error={connectionError} title="Connection Error" variant="warning" showHelpText={true} />
      )}

      {error && (
        <ErrorAlert error={error} onDismiss={() => setError(null)} showHelpText={true} />
      )}

      {/* Session View */}
      {sessionId && (
        <SessionView
          sessionId={sessionId}
          joinCode={joinCode}
          sessionContext={sessionContext}
          students={students}
          realtimeStudents={mappedRealtimeStudents}
          sessionProblem={sessionProblem}
          sessionExecutionSettings={sessionExecutionSettings}
          onEndSession={handleEndSession}
          onUpdateProblem={handleUpdateProblem}
          onFeatureStudent={handleFeatureStudent}
          onClearPublicView={handleClearPublicView}
          executeCode={handleExecuteCode}
          featuredStudentId={realtimeSession?.featuredStudentId}
        />
      )}
    </div>
  );
}
