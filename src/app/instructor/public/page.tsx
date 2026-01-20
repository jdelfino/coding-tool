'use client';

import React, { useEffect, useState, useCallback, Suspense, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase/client';
import { Problem } from '@/server/types/problem';
import CodeEditor from '@/app/student/components/CodeEditor';
import { useApiDebugger } from '@/hooks/useApiDebugger';
import { ProtectedRoute } from '@/components/ProtectedRoute';

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
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          border: '1px solid #ccc',
          borderRadius: '4px'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem' }}>No Session</h1>
          <p style={{ color: '#666' }}>Please provide a sessionId in the URL.</p>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{ fontSize: '1.25rem', color: '#666' }}>Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{
        minHeight: '100vh',
        backgroundColor: '#f9fafb',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center'
      }}>
        <div style={{
          backgroundColor: 'white',
          padding: '2rem',
          border: '1px solid #fca5a5',
          borderRadius: '4px'
        }}>
          <h1 style={{ fontSize: '1.5rem', fontWeight: 'bold', marginBottom: '1rem', color: '#dc2626' }}>Error</h1>
          <p style={{ color: '#666' }}>{error}</p>
        </div>
      </div>
    );
  }

  const problemText = state?.problem?.description || '';

  return (
    <main style={{
      padding: '1rem',
      width: '100%',
      height: '100vh',
      boxSizing: 'border-box',
      display: 'flex',
      flexDirection: 'column'
    }}>
      <h1 style={{ marginBottom: '1rem', flexShrink: 0 }}>Public Display</h1>

      {/* Compact Header with Problem and Join Code */}
      <div style={{
        padding: '1rem',
        border: '1px solid #ccc',
        borderRadius: '4px',
        marginBottom: '1rem',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        gap: '1.5rem',
        flexShrink: 0
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <h2 style={{ marginTop: 0, marginBottom: '0.5rem', fontSize: '1.25rem' }}>Problem</h2>
          {problemText ? (
            <pre style={{
              whiteSpace: 'pre-wrap',
              color: '#333',
              fontFamily: 'inherit',
              fontSize: '0.9rem',
              margin: 0
            }}>
              {problemText}
            </pre>
          ) : (
            <p style={{ color: '#999', fontStyle: 'italic', margin: 0 }}>No problem set yet</p>
          )}
        </div>
        <div style={{
          textAlign: 'right',
          flexShrink: 0,
          borderLeft: '2px solid #ddd',
          paddingLeft: '1.5rem'
        }}>
          <p style={{ fontSize: '0.75rem', color: '#666', marginBottom: '0.25rem', marginTop: 0 }}>Section Join Code</p>
          <p style={{
            fontSize: '2rem',
            fontWeight: 'bold',
            color: '#0070f3',
            fontFamily: 'monospace',
            margin: 0,
            marginBottom: '0.5rem'
          }}>
            {state?.joinCode || '------'}
          </p>
          <p style={{ fontSize: '0.7rem', color: '#666', marginTop: '0.5rem', marginBottom: 0 }}>
            Students join your section with this code
          </p>
        </div>
      </div>

      {/* Featured Submission */}
      {state?.hasFeaturedSubmission ? (
        <div style={{
          padding: '1rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          flex: 1,
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column'
        }}>
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
            <CodeEditor
              code={localCode}
              onChange={setLocalCode}
              problem={state.problem}
              title="Featured Code"
              useApiExecution={true}
              debugger={debuggerHook}
            />
          </div>
        </div>
      ) : (
        <div style={{
          padding: '3rem',
          border: '1px solid #ccc',
          borderRadius: '4px',
          textAlign: 'center'
        }}>
          <p style={{ color: '#999', fontSize: '1.125rem', fontStyle: 'italic', marginBottom: '0.5rem' }}>
            No submission selected for display
          </p>
          <p style={{ color: '#666', fontSize: '0.875rem' }}>
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
        <div style={{
          minHeight: '100vh',
          backgroundColor: '#f9fafb',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}>
          <div style={{ fontSize: '1.25rem', color: '#666' }}>Loading...</div>
        </div>
      }>
        <PublicViewContent />
      </Suspense>
    </ProtectedRoute>
  );
}
