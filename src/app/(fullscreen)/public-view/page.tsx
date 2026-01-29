'use client';

import React, { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Problem } from '@/server/types/problem';
import CodeEditor from '@/app/(fullscreen)/student/components/CodeEditor';
import { useApiDebugger } from '@/hooks/useApiDebugger';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import MarkdownContent from '@/components/MarkdownContent';

interface PublicSessionState {
  sessionId: string;
  joinCode: string;
  problem: Problem | null;
  featuredStudentId: string | null;
  featuredCode: string | null;
  hasFeaturedSubmission: boolean;
}

function PublicViewContent() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('sessionId');

  const [state, setState] = useState<PublicSessionState | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Local code state for editing (changes don't propagate back to student)
  const [localCode, setLocalCode] = useState<string>('');
  const lastFeaturedStudentId = useRef<string | null>(null);
  const lastFeaturedCode = useRef<string | null>(null);

  // Fetch session state from API
  const fetchState = useCallback(async () => {
    if (!sessionId) return;

    try {
      const res = await fetch(`/api/sessions/${sessionId}/public-state`);
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || 'Failed to load session');
      }
      const data = await res.json();
      setState(data);
      setError(null);
    } catch (e: any) {
      console.error('[PublicView] Failed to fetch state:', e);
      setError(e.message || 'Failed to load session');
    } finally {
      setLoading(false);
    }
  }, [sessionId]);

  // Listen for Broadcast messages (more reliable than postgres_changes, recommended by Supabase)
  const [isConnected, setIsConnected] = useState(false);

  useEffect(() => {
    if (!sessionId) return;

    const supabase = getSupabaseBrowserClient();
    const channelName = `session:${sessionId}`;

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'featured_student_changed' }, (payload) => {
        if (payload.payload) {
          const { featuredStudentId, featuredCode } = payload.payload;
          setState(prev => prev ? {
            ...prev,
            featuredStudentId,
            featuredCode,
            hasFeaturedSubmission: !!featuredStudentId,
          } : prev);
        }
      })
      .on('broadcast', { event: 'problem_updated' }, (payload) => {
        if (payload.payload) {
          const { problem } = payload.payload;
          setState(prev => prev ? {
            ...prev,
            problem,
          } : prev);
        }
      })
      .subscribe((status) => {
        setIsConnected(status === 'SUBSCRIBED');
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  // Debugger hook for API-based trace requests
  const debuggerHook = useApiDebugger(sessionId);

  // Initial fetch
  useEffect(() => {
    fetchState();
  }, [fetchState]);

  // Reset local code when featured student or their code changes
  useEffect(() => {
    const studentChanged = state?.featuredStudentId !== lastFeaturedStudentId.current;
    const codeChanged = state?.featuredCode !== lastFeaturedCode.current;

    if (studentChanged || codeChanged) {
      lastFeaturedStudentId.current = state?.featuredStudentId || null;
      lastFeaturedCode.current = state?.featuredCode || null;
      setLocalCode(state?.featuredCode || '');
    }
  }, [state?.featuredStudentId, state?.featuredCode]);

  // Fallback: Poll for updates every 2 seconds ONLY when disconnected
  // This compensates for Realtime connection issues
  useEffect(() => {
    if (!sessionId || isConnected) return;

    const pollInterval = setInterval(() => {
      fetchState();
    }, 2000);

    return () => clearInterval(pollInterval);
  }, [sessionId, isConnected, fetchState]);

  if (!sessionId) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 border border-gray-300 rounded">
          <h1 className="text-xl font-bold mb-4">No Session</h1>
          <p className="text-gray-500">Please provide a sessionId in the URL.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="text-lg text-gray-500">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="h-full bg-gray-50 flex items-center justify-center">
        <div className="bg-white p-8 border border-red-300 rounded">
          <h1 className="text-xl font-bold mb-4 text-red-600">Error</h1>
          <p className="text-gray-500">{error}</p>
        </div>
      </div>
    );
  }

  const problemText = state?.problem?.description || '';

  return (
    <main className="h-full w-full flex flex-col p-2 box-border">
      {/* Compact Header with Problem and Join Code */}
      <div className="flex justify-between items-start gap-4 flex-shrink-0 pb-2 border-b border-gray-200 mb-2">
        <div className="flex-1 min-w-0">
          <h2 className="mt-0 mb-1 text-base font-semibold">Problem</h2>
          {problemText ? (
            <MarkdownContent content={problemText} className="text-sm" />
          ) : (
            <p className="text-gray-400 italic m-0 text-sm">No problem set yet</p>
          )}
        </div>
        <div className="text-right flex-shrink-0 border-l-2 border-gray-200 pl-4">
          <p className="text-xs text-gray-500 mb-0.5 mt-0">Section Join Code</p>
          <p className="text-2xl font-bold text-blue-500 font-mono m-0 mb-1">
            {state?.joinCode || '------'}
          </p>
          <p className="text-xs text-gray-500 mt-1 mb-0">
            Students join your section with this code
          </p>
        </div>
      </div>

      {/* Featured Submission */}
      {state?.hasFeaturedSubmission ? (
        <div className="flex-1 min-h-0 flex flex-col">
          <CodeEditor
            code={localCode}
            onChange={setLocalCode}
            problem={state.problem}
            title="Featured Code"
            useApiExecution={true}
            debugger={debuggerHook}
          />
        </div>
      ) : (
        <div className="p-8 border border-gray-300 rounded text-center">
          <p className="text-gray-400 text-lg italic mb-1">
            No submission selected for display
          </p>
          <p className="text-gray-500 text-sm">
            Select a student submission from the instructor dashboard
          </p>
        </div>
      )}
    </main>
  );
}

export default function PublicInstructorView() {
  return (
    <ProtectedRoute requiredRole="instructor">
      <Suspense fallback={
        <div className="h-full bg-gray-50 flex items-center justify-center">
          <div className="text-lg text-gray-500">Loading...</div>
        </div>
      }>
        <PublicViewContent />
      </Suspense>
    </ProtectedRoute>
  );
}
