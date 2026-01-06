'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useSearchParams } from 'next/navigation';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionHistory, SessionHistory } from '@/hooks/useSessionHistory';
import { Problem, ExecutionSettings } from '@/server/types/problem';
import { useDebugger } from '@/hooks/useDebugger';
import CodeEditor from './components/CodeEditor';
import { EditorContainer } from './components/EditorContainer';
import SessionEndedNotification from './components/SessionEndedNotification';

function StudentPage() {
  const { user, signOut } = useAuth();
  const searchParams = useSearchParams();
  const sessionIdFromUrl = searchParams.get('sessionId');
  const { sessions, isLoading: isLoadingSessions, refetch: refetchSessions } = useSessionHistory();
  const [joined, setJoined] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [sessionExecutionSettings, setSessionExecutionSettings] = useState<{
    stdin?: string;
    randomSeed?: number;
    attachedFiles?: Array<{ name: string; content: string }>;
  }>({});
  const [studentExecutionSettings, setStudentExecutionSettings] = useState<{
    randomSeed?: number;
    attachedFiles?: Array<{ name: string; content: string }>;
  } | null>(null);
  const [code, setCode] = useState('');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Construct WebSocket URL - only initialize on client side
  const [wsUrl, setWsUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/ws`;
      setWsUrl(url);
    }
  }, []);

  const { isConnected, connectionStatus, connectionError, lastMessage, sendMessage } = useWebSocket(wsUrl);

  // Debugger state
  const debuggerHook = useDebugger(sendMessage);

  // Define handlers with useCallback to avoid dependency issues
  const handleJoin = useCallback((sessionId: string) => {
    // Validate session ID
    if (!sessionId) {
      setError('Invalid session ID');
      return;
    }

    // Use username from auth context
    const studentName = user?.username || 'Student';

    setError(null);
    setIsJoining(true);
    sendMessage('JOIN_SESSION', { sessionId, studentName });

    // Set timeout for join operation
    setTimeout(() => {
      setIsJoining(prev => {
        if (prev) {
          setError('Join request timed out. Please try again.');
        }
        return false;
      });
    }, 10000);
  }, [user?.username, sendMessage]);

  const handleRejoinSession = useCallback((sessionId: string) => {
    setCurrentSessionId(sessionId);
    handleJoin(sessionId);
  }, [handleJoin]);

  // Track if we've already initiated a join for this sessionId to prevent loops
  const joinAttemptedRef = useRef<string | null>(null);

  // Simple logic: If there's a sessionId in URL, join it
  // No smart redirects, no auto-rejoin complexity
  useEffect(() => {
    if (!sessionIdFromUrl) {
      // No sessionId in URL - nothing to do
      return;
    }

    // If we're already joined to this session, clear the attempt flag
    if (joined && currentSessionId === sessionIdFromUrl) {
      joinAttemptedRef.current = null;
      return;
    }

    // If we're currently joining, wait
    if (isJoining) {
      return;
    }

    // Check if we've already attempted to join this specific session
    if (joinAttemptedRef.current === sessionIdFromUrl) {
      return;
    }

    // Join the session from the URL
    if (isConnected) {
      joinAttemptedRef.current = sessionIdFromUrl;
      handleRejoinSession(sessionIdFromUrl);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionIdFromUrl, joined, currentSessionId, isJoining, isConnected]);
  // Intentionally exclude handleRejoinSession to avoid re-runs

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    switch (lastMessage.type) {
      case 'SESSION_JOINED':
        setJoined(true);
        setStudentId(lastMessage.payload.studentId);
        setCurrentSessionId(lastMessage.payload.sessionId);
        setProblem(lastMessage.payload.problem || null);
        setSessionExecutionSettings(lastMessage.payload.sessionExecutionSettings || {});
        // Restore student-specific values if rejoining
        setStudentExecutionSettings(lastMessage.payload.studentExecutionSettings || null);
        // Restore existing code if rejoining (always set, even if empty string)
        setCode(lastMessage.payload.code || '');
        setIsJoining(false);
        setError(null);
        break;

      case 'PROBLEM_UPDATE':
        setProblem(lastMessage.payload.problem || null);
        setSessionExecutionSettings(lastMessage.payload.executionSettings || {});
        break;

      case 'EXECUTION_RESULT':
        setExecutionResult(lastMessage.payload);
        setIsRunning(false);
        break;

      case 'TRACE_RESPONSE':
        debuggerHook.setTrace(lastMessage.payload.trace);
        break;

      case 'SESSION_ENDED':
        // Session ended by instructor - show notification but keep student in session
        if (lastMessage.payload.sessionId === currentSessionId) {
          setSessionEnded(true);
          // Don't automatically kick them out - let them see their work
        }
        break;

      case 'ERROR':
        const errorMsg = lastMessage.payload.error || 'An error occurred';
        setError(errorMsg);
        setIsRunning(false);
        setIsJoining(false);
        // Reset debugger loading state if trace request failed
        if (debuggerHook.isLoading) {
          debuggerHook.setError(errorMsg);
        }
        break;
    }
  }, [lastMessage]);

  // Debounced code update
  useEffect(() => {
    if (!joined || !studentId) return;

    const timeout = setTimeout(() => {
      sendMessage('CODE_UPDATE', { code });
    }, 500);

    return () => clearTimeout(timeout);
  }, [code, joined, studentId, sendMessage]);

  // Send student settings updates (randomSeed and attachedFiles)
  useEffect(() => {
    if (!joined || !studentId || !studentExecutionSettings) return;

    // Only send if student has explicitly set values (not null = never set)
    sendMessage('UPDATE_STUDENT_SETTINGS', {
      executionSettings: {
        randomSeed: studentExecutionSettings.randomSeed,
        attachedFiles: studentExecutionSettings.attachedFiles !== undefined ? studentExecutionSettings.attachedFiles : undefined
      }
    });
  }, [studentExecutionSettings, joined, studentId, sendMessage]);

  const handleLeaveSession = () => {
    // Reset session state
    setJoined(false);
    setStudentId(null);
    setCurrentSessionId(null);
    setProblem(null);
    setSessionExecutionSettings({});
    setStudentExecutionSettings(null);
    setCode('');
    setExecutionResult(null);
    setSessionEnded(false);

    // Refresh sessions
    refetchSessions();
  };

  const editorRef = useRef<any>(null);

  const handleLoadStarterCode = useCallback((starterCode: string) => {
    if (code.trim().length > 0) {
      // Ask for confirmation if there's existing code
      if (confirm('This will replace your current code. Are you sure?')) {
        // Use Monaco editor API to preserve undo history
        if (editorRef.current) {
          const editor = editorRef.current;
          const model = editor.getModel();
          if (model) {
            const fullRange = model.getFullModelRange();
            editor.executeEdits('load-starter-code', [{
              range: fullRange,
              text: starterCode,
            }]);
          }
        } else {
          setCode(starterCode);
        }
      }
    } else {
      // Use Monaco editor API to preserve undo history
      if (editorRef.current) {
        const editor = editorRef.current;
        const model = editor.getModel();
        if (model) {
          const fullRange = model.getFullModelRange();
          editor.executeEdits('load-starter-code', [{
            range: fullRange,
            text: starterCode,
          }]);
        }
      } else {
        setCode(starterCode);
      }
    }
  }, [code]);

  const handleRunCode = (executionSettings: ExecutionSettings) => {
    if (!isConnected) {
      setError('Not connected to server. Cannot run code.');
      return;
    }
    if (!code || code.trim().length === 0) {
      setError('Please write some code before running');
      return;
    }

    setError(null);
    setIsRunning(true);
    setExecutionResult(null);
    sendMessage('EXECUTE_CODE', {
      code,
      executionSettings
    });

    // Set timeout for execution
    setTimeout(() => {
      if (isRunning) {
        setError('Code execution timed out');
        setIsRunning(false);
      }
    }, 15000);
  };

  // Show loading state while WebSocket connects
  if (!isConnected) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Live Coding Classroom</h1>
        <p>Connecting...</p>
      </main>
    );
  }

  // No sessionId in URL - show error message
  if (!sessionIdFromUrl) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>No Session</h1>
        <p>Please navigate to a session from your sections page.</p>
        <a href="/sections" style={{ color: '#0070f3', textDecoration: 'underline' }}>
          Go to My Sections
        </a>
      </main>
    );
  }

  // Waiting to join or joining in progress
  if (!joined) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Live Coding Classroom</h1>
        <p>{isJoining ? 'Joining session...' : 'Loading...'}</p>
        {error && (
          <div style={{ marginTop: '1rem', color: '#e00', padding: '1rem', background: '#fee', borderRadius: '4px' }}>
            <strong>Error:</strong> {error}
          </div>
        )}
      </main>
    );
  }

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (error) {
      console.error('Sign out error:', error);
      setIsSigningOut(false);
    }
  };

  // Active session view
  return (
    <main style={{ padding: '1rem', width: '100%', height: '100vh', boxSizing: 'border-box', display: 'flex', flexDirection: 'column' }}>
      {/* Header with Sign Out */}
      <div style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: '1rem',
        flexShrink: 0
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
          <h1 style={{ margin: 0 }}>Live Coding Session</h1>
          <div style={{
            padding: '0.5rem 1rem',
            backgroundColor: connectionStatus === 'connected' ? '#d4edda' :
                            connectionStatus === 'connecting' ? '#fff3cd' : '#f8d7da',
            borderRadius: '4px',
            fontSize: '0.9rem'
          }}>
            {connectionStatus === 'connected' && '● Connected'}
            {connectionStatus === 'connecting' && '○ Reconnecting...'}
            {connectionStatus === 'disconnected' && '○ Disconnected'}
            {connectionStatus === 'failed' && '✕ Connection Lost'}
          </div>
        </div>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <button
            onClick={handleLeaveSession}
            style={{
              padding: '0.5rem 1rem',
              backgroundColor: 'transparent',
              color: '#0070f3',
              border: '1px solid #0070f3',
              borderRadius: '4px',
              cursor: 'pointer',
              fontSize: '0.9rem'
            }}
          >
            Leave Session
          </button>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: '1rem',
            padding: '0.5rem 1rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '4px',
            border: '1px solid #dee2e6'
          }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end' }}>
              <span style={{ fontWeight: 'bold', fontSize: '0.9rem' }}>{user?.username}</span>
              <span style={{
                fontSize: '0.75rem',
                color: '#28a745',
                fontWeight: '500'
              }}>Student</span>
            </div>
            <button
              onClick={handleSignOut}
              disabled={isSigningOut}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: '#dc3545',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: isSigningOut ? 'not-allowed' : 'pointer',
                fontSize: '0.9rem',
                opacity: isSigningOut ? 0.6 : 1
              }}
            >
              {isSigningOut ? 'Signing out...' : 'Sign Out'}
            </button>
          </div>
        </div>
      </div>

      {/* Connection Error */}
      {connectionError && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#fff3cd',
          color: '#856404',
          borderRadius: '4px',
          border: '1px solid #ffeaa7',
          flexShrink: 0
        }}>
          ⚠ {connectionError}
        </div>
      )}

      {/* Application Error */}
      {error && (
        <div style={{
          marginBottom: '1rem',
          padding: '0.75rem',
          backgroundColor: '#f8d7da',
          color: '#721c24',
          borderRadius: '4px',
          border: '1px solid #f5c6cb',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0
        }}>
          <span>{error}</span>
          <button
            onClick={() => setError(null)}
            style={{
              padding: '0.25rem 0.5rem',
              backgroundColor: 'transparent',
              border: '1px solid #721c24',
              borderRadius: '3px',
              cursor: 'pointer',
              color: '#721c24'
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Session Ended Notification */}
      {sessionEnded && (
        <SessionEndedNotification
          onLeaveToDashboard={handleLeaveSession}
        />
      )}

      <EditorContainer variant="flex">
        <CodeEditor
          code={code}
          onChange={setCode}
          onRun={handleRunCode}
          isRunning={isRunning}
          exampleInput={sessionExecutionSettings.stdin}
          randomSeed={studentExecutionSettings?.randomSeed !== undefined ? studentExecutionSettings.randomSeed : sessionExecutionSettings.randomSeed}
          onRandomSeedChange={(seed) => setStudentExecutionSettings(prev => ({ ...prev, randomSeed: seed }))}
          attachedFiles={studentExecutionSettings?.attachedFiles !== undefined ? studentExecutionSettings.attachedFiles : sessionExecutionSettings.attachedFiles}
          onAttachedFilesChange={(files) => setStudentExecutionSettings(prev => ({ ...prev, attachedFiles: files }))}
          executionResult={executionResult}
          problem={problem}
          onLoadStarterCode={handleLoadStarterCode}
          externalEditorRef={editorRef}
          debugger={debuggerHook}
        />
      </EditorContainer>
    </main>
  );
}

export default function StudentPageWrapper() {
  return (
    <ProtectedRoute requiredRole="student">
      <StudentPage />
    </ProtectedRoute>
  );
}
