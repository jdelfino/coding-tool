'use client';

import { useState, useEffect, useCallback } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import JoinForm from './components/JoinForm';
import ProblemDisplay from './components/ProblemDisplay';
import CodeEditor from './components/CodeEditor';
import OutputPanel from './components/OutputPanel';

function StudentPage() {
  const { user, signOut } = useAuth();
  const [joined, setJoined] = useState(false);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [problemText, setProblemText] = useState('');
  const [code, setCode] = useState('');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isJoining, setIsJoining] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);

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

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('Received message:', lastMessage.type);

    switch (lastMessage.type) {
      case 'SESSION_JOINED':
        setJoined(true);
        setStudentId(lastMessage.payload.studentId);
        setProblemText(lastMessage.payload.problemText || '');
        setIsJoining(false);
        setError(null);
        break;

      case 'PROBLEM_UPDATE':
        setProblemText(lastMessage.payload.problemText);
        break;

      case 'EXECUTION_RESULT':
        setExecutionResult(lastMessage.payload);
        setIsRunning(false);
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

  const handleJoin = (joinCode: string) => {
    // Validate join code
    if (!joinCode || joinCode.length !== 6) {
      setError('Join code must be 6 characters');
      return;
    }

    // Use username from auth context
    const studentName = user?.username || 'Student';

    setError(null);
    setIsJoining(true);
    sendMessage('JOIN_SESSION', { joinCode, studentName });
    
    // Set timeout for join operation
    setTimeout(() => {
      if (isJoining && !joined) {
        setError('Join request timed out. Please try again.');
        setIsJoining(false);
      }
    }, 10000);
  };

  const handleRunCode = () => {
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
    sendMessage('EXECUTE_CODE', { code });
    
    // Set timeout for execution
    setTimeout(() => {
      if (isRunning) {
        setError('Code execution timed out');
        setIsRunning(false);
      }
    }, 15000);
  };

  if (!joined) {
    return (
      <main style={{ padding: '2rem' }}>
        <h1 style={{ textAlign: 'center' }}>Live Coding Classroom</h1>
        
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

        {/* Header with Sign Out */}
        <div style={{ 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          marginBottom: '1rem'
        }}>
          <h2 style={{ margin: 0 }}>Join a Session</h2>
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

        <JoinForm 
          onJoin={handleJoin} 
          username={user?.username || 'Student'}
          isJoining={isJoining} 
          disabled={!isConnected || connectionStatus === 'failed'} 
        />
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

      <ProblemDisplay problemText={problemText} />

      <CodeEditor
        code={code}
        onChange={setCode}
        onRun={handleRunCode}
        isRunning={isRunning}
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
