'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionHistory, SessionHistory } from '@/hooks/useSessionHistory';
import { Problem, ExecutionSettings } from '@/server/types/problem';
import { useDebugger } from '@/hooks/useDebugger';
import StudentDashboard from './components/StudentDashboard';
import CodeEditor from './components/CodeEditor';
import SessionEndedNotification from './components/SessionEndedNotification';

function StudentPage() {
  const { user, signOut } = useAuth();
  const { sessions, isLoading: isLoadingSessions, refetch: refetchSessions } = useSessionHistory();
  const [hasSections, setHasSections] = useState<boolean | null>(null);
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
  const [hasCheckedAutoRejoin, setHasCheckedAutoRejoin] = useState(false);
  const [sessionEnded, setSessionEnded] = useState(false);

  // Construct WebSocket URL - only initialize on client side
  const [wsUrl, setWsUrl] = useState('');

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const host = window.location.host;
      const url = `${protocol}//${host}/ws`;
      console.log('WebSocket URL:', url);
      setWsUrl(url);
    }
  }, []);

  // Check if student has any sections
  useEffect(() => {
    const checkSections = async () => {
      try {
        const response = await fetch('/api/sections/my');
        if (response.ok) {
          const data = await response.json();
          setHasSections(data.sections && data.sections.length > 0);
        }
      } catch (err) {
        console.error('Failed to check sections:', err);
        setHasSections(false);
      }
    };
    if (user) {
      checkSections();
    }
  }, [user]);

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

    console.log('[JOIN] Joining session with username:', studentName, 'user:', user);
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

  // Auto-rejoin logic: check for active sessions on mount (only after WebSocket connects)
  useEffect(() => {
    if (!hasCheckedAutoRejoin && !isLoadingSessions && isConnected) {
      setHasCheckedAutoRejoin(true);

      if (sessions.length > 0) {
        // Filter active sessions
        const activeSessions = sessions.filter(s => s.status === 'active');

        // If exactly one active session, auto-rejoin
        if (activeSessions.length === 1) {
          const session = activeSessions[0];
          console.log('Auto-rejoining session:', session.id);
          handleRejoinSession(session.id);
        } else {
          // Multiple or no active sessions - show dashboard
        }
      } else {
        // No sessions at all - show dashboard
      }
    }
  }, [hasCheckedAutoRejoin, isLoadingSessions, isConnected, sessions, handleRejoinSession]);

  // Handle WebSocket reconnection - rejoin session if we were in one
  useEffect(() => {
    // If we reconnected and we have a current session, rejoin it
    if (isConnected && currentSessionId && joined && !isJoining) {
      const session = sessions.find(s => s.id === currentSessionId);
      if (session) {
        console.log('WebSocket reconnected, rejoining session:', session.id);
        setJoined(false); // Reset joined state
        handleRejoinSession(session.id);
      }
    }
  }, [isConnected]); // Only trigger on isConnected changes

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('Received message:', lastMessage.type);

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

  const handleShowJoinForm = () => {
    // Redirect to sections page to join sections
    window.location.href = '/sections/join';
  };

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

  // Show loading state while checking for auto-rejoin
  if (!hasCheckedAutoRejoin || isLoadingSessions) {
    return (
      <main style={{ padding: '2rem', textAlign: 'center' }}>
        <h1>Live Coding Classroom</h1>
        <p>Loading...</p>
      </main>
    );
  }

  // Dashboard or Join Form view (not in a session)
  if (!joined) {
    return (
      <main style={{ padding: '2rem' }}>
        {/* Header with Sign Out */}
        <div style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '2rem'
        }}>
          <div>
            <h1 style={{ margin: 0 }}>Live Coding Classroom</h1>
            <p style={{ margin: '0.5rem 0 0 0', color: '#666' }}>
              Student Dashboard
            </p>
          </div>
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
              onClick={async () => {
                setIsSigningOut(true);
                try {
                  await signOut();
                } catch (error) {
                  console.error('Sign out error:', error);
                  setIsSigningOut(false);
                }
              }}
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

        {/* Connection Status */}
        <div style={{
          textAlign: 'center',
          marginBottom: '1rem',
          padding: '0.5rem',
          backgroundColor: connectionStatus === 'connected' ? '#d4edda' :
                          connectionStatus === 'connecting' ? '#fff3cd' : '#f8d7da',
          borderRadius: '4px'
        }}>
          {connectionStatus === 'connected' && '● Connected to server'}
          {connectionStatus === 'connecting' && '○ Connecting to server...'}
          {connectionStatus === 'disconnected' && '○ Disconnected'}
          {connectionStatus === 'failed' && '✕ Connection failed'}
        </div>

        {/* Connection Error */}
        {connectionError && (
          <div style={{
            textAlign: 'center',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            border: '1px solid #f5c6cb'
          }}>
            {connectionError}
          </div>
        )}

        {/* Application Error */}
        {error && (
          <div style={{
            textAlign: 'center',
            marginBottom: '1rem',
            padding: '0.75rem',
            backgroundColor: '#f8d7da',
            color: '#721c24',
            borderRadius: '4px',
            border: '1px solid #f5c6cb'
          }}>
            {error}
            <button
              onClick={() => setError(null)}
              style={{
                marginLeft: '1rem',
                padding: '0.25rem 0.5rem',
                backgroundColor: 'transparent',
                border: '1px solid #721c24',
                borderRadius: '3px',
                cursor: 'pointer',
                color: '#721c24'
              }}
            >
              Dismiss
            </button>
          </div>
        )}

        {/* Dashboard */}
        {hasSections === false ? (
          <div className="text-center py-16 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl border-2 border-dashed border-blue-300">
            <div className="flex justify-center mb-6">
              <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center">
                <svg className="w-10 h-10 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Join a Section</h2>
            <p className="text-gray-600 mb-6">You're not enrolled in any sections yet. Enter a section join code to get started.</p>
            <button
              onClick={() => window.location.href = '/sections/join'}
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg shadow-lg hover:bg-blue-700 hover:shadow-xl transform hover:-translate-y-0.5 transition-all duration-200"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              Enter Section Join Code
            </button>
          </div>
        ) : (
          <StudentDashboard
            sessions={sessions}
            onJoinNewSession={handleShowJoinForm}
            onRejoinSession={handleRejoinSession}
            disabled={!isConnected || connectionStatus === 'failed'}
          />
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

      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
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
      </div>
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
