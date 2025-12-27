'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import { useSessionHistory, SessionHistory } from '@/hooks/useSessionHistory';
import { Problem, ExecutionSettings } from '@/server/types/problem';
import JoinForm from './components/JoinForm';
import StudentDashboard from './components/StudentDashboard';
import ProblemDisplay from './components/ProblemDisplay';
import CodeEditor from './components/CodeEditor';
import OutputPanel from './components/OutputPanel';
import SessionEndedNotification from './components/SessionEndedNotification';

function StudentPage() {
  const { user, signOut } = useAuth();
  const { sessions, isLoading: isLoadingSessions, refetch: refetchSessions } = useSessionHistory();
  const [view, setView] = useState<'dashboard' | 'join' | 'session'>('dashboard');
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
  
  const { isConnected, connectionStatus, connectionError, lastMessage, sendMessage } = useWebSocket(wsUrl);

  // Define handlers with useCallback to avoid dependency issues
  const handleJoin = useCallback((joinCode: string) => {
    // Validate join code
    if (!joinCode || joinCode.length !== 6) {
      setError('Join code must be 6 characters');
      return;
    }

    // Use username from auth context
    const studentName = user?.username || 'Student';

    console.log('[JOIN] Joining session with username:', studentName, 'user:', user);
    setError(null);
    setIsJoining(true);
    sendMessage('JOIN_SESSION', { joinCode, studentName });
    
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

  const handleRejoinSession = useCallback((sessionId: string, joinCode: string) => {
    setCurrentSessionId(sessionId);
    handleJoin(joinCode);
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
          console.log('Auto-rejoining session:', session.joinCode);
          handleRejoinSession(session.id, session.joinCode);
        } else {
          // Multiple or no active sessions - show dashboard
          setView('dashboard');
        }
      } else {
        // No sessions at all - show dashboard
        setView('dashboard');
      }
    }
  }, [hasCheckedAutoRejoin, isLoadingSessions, isConnected, sessions, handleRejoinSession]);

  // Handle WebSocket reconnection - rejoin session if we were in one
  useEffect(() => {
    // If we reconnected and we have a current session, rejoin it
    if (isConnected && currentSessionId && joined && !isJoining) {
      const session = sessions.find(s => s.id === currentSessionId);
      if (session) {
        console.log('WebSocket reconnected, rejoining session:', session.joinCode);
        setJoined(false); // Reset joined state
        handleRejoinSession(session.id, session.joinCode);
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
        setView('session');
        break;

      case 'PROBLEM_UPDATE':
        setProblem(lastMessage.payload.problem || null);
        setSessionExecutionSettings(lastMessage.payload.executionSettings || {});
        break;

      case 'EXECUTION_RESULT':
        setExecutionResult(lastMessage.payload);
        setIsRunning(false);
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

  const handleShowDashboard = () => {
    setView('dashboard');
  };

  const handleShowJoinForm = () => {
    setView('join');
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
    setView('dashboard');
    
    // Refresh sessions
    refetchSessions();
  };

  const handleLoadStarterCode = useCallback((starterCode: string) => {
    if (code.trim().length > 0) {
      // Ask for confirmation if there's existing code
      if (confirm('This will replace your current code. Are you sure?')) {
        setCode(starterCode);
      }
    } else {
      setCode(starterCode);
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

        {/* Dashboard or Join Form */}
        {view === 'dashboard' ? (
          <StudentDashboard
            sessions={sessions}
            onJoinNewSession={handleShowJoinForm}
            onRejoinSession={handleRejoinSession}
            disabled={!isConnected || connectionStatus === 'failed'}
          />
        ) : (
          <div>
            <div style={{ marginBottom: '1rem' }}>
              <button
                onClick={handleShowDashboard}
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
                ← Back to Dashboard
              </button>
            </div>
            <h2>Join a Session</h2>
            <JoinForm 
              onJoin={handleJoin} 
              username={user?.username || 'Student'}
              isJoining={isJoining} 
              disabled={!isConnected || connectionStatus === 'failed'} 
            />
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
    <main style={{ padding: '2rem', maxWidth: '1000px', margin: '0 auto' }}>
      {/* Header with Sign Out */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem'
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
          border: '1px solid #ffeaa7'
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
          alignItems: 'center'
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

      <ProblemDisplay 
        problem={problem}
        onLoadStarterCode={handleLoadStarterCode}
      />

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
      />

      <OutputPanel result={executionResult} />
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
