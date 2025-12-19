'use client';

import { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import SessionControls from './components/SessionControls';
import SessionDashboard from './components/SessionDashboard';
import ProblemInput from './components/ProblemInput';
import StudentList from './components/StudentList';
import CodeViewer from './components/CodeViewer';

interface Student {
  id: string;
  name: string;
  hasCode: boolean;
}

interface SessionInfo {
  id: string;
  joinCode: string;
  problemText: string;
  studentCount: number;
  createdAt: string;
  lastActivity: string;
}

function InstructorPage() {
  const { user, signOut } = useAuth();
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentCode, setSelectedStudentCode] = useState<string>('');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
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

  // Request session list when connected
  useEffect(() => {
    if (isConnected && !sessionId) {
      sendMessage('LIST_SESSIONS', {});
    }
  }, [isConnected, sessionId]);

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('Received message:', lastMessage.type);

    switch (lastMessage.type) {
      case 'SESSION_CREATED':
        setSessionId(lastMessage.payload.sessionId);
        setJoinCode(lastMessage.payload.joinCode);
        setIsCreatingSession(false);
        setError(null);
        break;

      case 'SESSION_LIST':
        setSessions(lastMessage.payload.sessions || []);
        break;

      case 'SESSION_JOINED':
        setSessionId(lastMessage.payload.sessionId);
        setJoinCode(lastMessage.payload.joinCode);
        setError(null);
        break;

      case 'SESSION_ENDED':
        // If our current session was ended, go back to dashboard
        if (lastMessage.payload.sessionId === sessionId) {
          setSessionId(null);
          setJoinCode(null);
          setStudents([]);
          setSelectedStudentId(null);
          setSelectedStudentCode('');
          // Refresh session list
          sendMessage('LIST_SESSIONS', {});
        } else {
          // Another session was ended, refresh list
          setSessions(sessions.filter(s => s.id !== lastMessage.payload.sessionId));
        }
        break;

      case 'STUDENT_LIST_UPDATE':
        setStudents(lastMessage.payload.students);
        break;

      case 'STUDENT_CODE':
        setSelectedStudentCode(lastMessage.payload.code);
        break;

      case 'EXECUTION_RESULT':
        setExecutionResult(lastMessage.payload);
        break;

      case 'ERROR':
        const errorMsg = lastMessage.payload.error || 'An error occurred';
        setError(errorMsg);
        setIsCreatingSession(false);
        break;
    }
  }, [lastMessage]);

  const handleCreateSession = () => {
    if (!isConnected) {
      setError('Not connected to server. Please wait for connection.');
      return;
    }
    setError(null);
    setIsCreatingSession(true);
    sendMessage('CREATE_SESSION', {});
    
    // Timeout for session creation
    setTimeout(() => {
      if (isCreatingSession && !sessionId) {
        setError('Session creation timed out. Please try again.');
        setIsCreatingSession(false);
      }
    }, 10000);
  };

  const handleJoinExistingSession = (sessionId: string) => {
    if (!isConnected) {
      setError('Not connected to server.');
      return;
    }
    setError(null);
    sendMessage('JOIN_EXISTING_SESSION', { sessionId });
  };

  const handleEndSession = (sessionId: string) => {
    if (!isConnected) {
      setError('Not connected to server.');
      return;
    }
    setError(null);
    sendMessage('END_SESSION', { sessionId });
  };

  const handleLeaveSession = () => {
    // Leave session view without ending the session
    setSessionId(null);
    setJoinCode(null);
    setStudents([]);
    setSelectedStudentId(null);
    setSelectedStudentCode('');
    setError(null);
  };

  const handleUpdateProblem = (problemText: string) => {
    if (!isConnected) {
      setError('Not connected to server. Cannot update problem.');
      return;
    }
    if (problemText.length > 10000) {
      setError('Problem text is too long (max 10,000 characters)');
      return;
    }
    setError(null);
    sendMessage('UPDATE_PROBLEM', { problemText });
  };

  const handleSelectStudent = (studentId: string) => {
    if (!isConnected) {
      setError('Not connected to server.');
      return;
    }
    setError(null);
    setSelectedStudentId(studentId);
    setExecutionResult(null);
    sendMessage('REQUEST_STUDENT_CODE', { studentId });
  };

  const handleRunCode = () => {
    if (!isConnected) {
      setError('Not connected to server. Cannot run code.');
      return;
    }
    if (!selectedStudentId) {
      setError('No student selected');
      return;
    }
    setError(null);
    sendMessage('EXECUTE_STUDENT_CODE', { studentId: selectedStudentId });
  };

  const handleShowOnPublicView = (studentId: string) => {
    sendMessage('SELECT_SUBMISSION_FOR_PUBLIC', { studentId });
  };

  const handleOpenPublicView = () => {
    if (sessionId) {
      const publicUrl = `/instructor/public?sessionId=${sessionId}`;
      window.open(publicUrl, '_blank');
    }
  };

  const selectedStudent = students.find(s => s.id === selectedStudentId);

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
    <main style={{ padding: '2rem', maxWidth: '1200px', margin: '0 auto' }}>
      {/* Header with Sign Out */}
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '1rem'
      }}>
        <h1 style={{ margin: 0 }}>Instructor Dashboard</h1>
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
              color: '#0070f3',
              fontWeight: '500'
            }}>Instructor</span>
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
      
      {/* Connection Status */}
      <div style={{ 
        padding: '0.5rem 1rem', 
        backgroundColor: connectionStatus === 'connected' ? '#d4edda' : 
                        connectionStatus === 'connecting' ? '#fff3cd' : '#f8d7da',
        borderRadius: '4px',
        marginBottom: '1rem'
      }}>
        {connectionStatus === 'connected' && '● Connected'}
        {connectionStatus === 'connecting' && '○ Connecting...'}
        {connectionStatus === 'disconnected' && '○ Disconnected'}
        {connectionStatus === 'failed' && '✕ Connection Failed'}
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

      {!sessionId ? (
        <SessionDashboard
          sessions={sessions}
          onCreateSession={handleCreateSession}
          onJoinSession={handleJoinExistingSession}
          onEndSession={handleEndSession}
          isCreating={isCreatingSession}
          disabled={!isConnected || connectionStatus === 'failed'}
        />
      ) : (
        <>
          <div style={{ marginBottom: '1rem' }}>
            <button
              onClick={handleLeaveSession}
              style={{
                padding: '0.5rem 1rem',
                backgroundColor: 'transparent',
                color: '#0070f3',
                border: '1px solid #0070f3',
                borderRadius: '4px',
                cursor: 'pointer',
                fontSize: '0.9rem',
                display: 'flex',
                alignItems: 'center',
                gap: '0.5rem'
              }}
            >
              <svg 
                width="16" 
                height="16" 
                viewBox="0 0 24 24" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="2"
              >
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
              Back to Dashboard
            </button>
          </div>
          <SessionControls 
            sessionId={sessionId}
            joinCode={joinCode}
            onCreateSession={handleCreateSession}
            isCreating={isCreatingSession}
            disabled={!isConnected || connectionStatus === 'failed'}
          />

          <div style={{ 
            padding: '1rem', 
            backgroundColor: '#e7f3ff', 
            borderRadius: '4px',
            marginBottom: '1rem',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center'
          }}>
            <div>
              <strong>Public Display View</strong>
              <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.9rem', color: '#666' }}>
                Open this in a separate tab/window to display on a projector
              </p>
            </div>
            <button
              onClick={handleOpenPublicView}
              style={{
                padding: '0.75rem 1.5rem',
                backgroundColor: '#0070f3',
                color: 'white',
                border: 'none',
                borderRadius: '4px',
                cursor: 'pointer',
                fontWeight: 'bold',
              }}
            >
              Open Public View
            </button>
          </div>

          <ProblemInput onUpdateProblem={handleUpdateProblem} />
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <StudentList 
              students={students}
              onSelectStudent={handleSelectStudent}
              onShowOnPublicView={handleShowOnPublicView}
            />
            
            <CodeViewer
              code={selectedStudentCode}
              studentName={selectedStudent?.name}
              executionResult={executionResult}
              onRunCode={handleRunCode}
            />
          </div>
        </>
      )}
    </main>
  );
}

export default function InstructorPageWrapper() {
  return (
    <ProtectedRoute requiredRole="instructor">
      <InstructorPage />
    </ProtectedRoute>
  );
}