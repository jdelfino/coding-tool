'use client';

import React, { useState, useEffect } from 'react';
import { useWebSocket } from '@/hooks/useWebSocket';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/contexts/AuthContext';
import ClassList from './components/ClassList';
import SectionView from './components/SectionView';
import SessionControls from './components/SessionControls';
import ProblemInput from './components/ProblemInput';
import StudentList from './components/StudentList';
import CodeEditor from '@/app/student/components/CodeEditor';
import OutputPanel from '@/app/student/components/OutputPanel';
import RevisionViewer from './components/RevisionViewer';

interface Student {
  id: string;
  name: string;
  hasCode: boolean;
  randomSeed?: number;
  attachedFiles?: Array<{ name: string; content: string }>;
}

type ViewMode = 'classes' | 'sections' | 'session';

interface ClassContext {
  classId: string;
  className: string;
}

interface SessionContext {
  sectionId: string;
  sectionName: string;
}

function InstructorPage() {
  const { user, signOut } = useAuth();
  
  // Navigation state
  const [viewMode, setViewMode] = useState<ViewMode>('classes');
  const [classContext, setClassContext] = useState<ClassContext | null>(null);
  const [sessionContext, setSessionContext] = useState<SessionContext | null>(null);
  
  // Session state
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [joinCode, setJoinCode] = useState<string | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [selectedStudentCode, setSelectedStudentCode] = useState<string>('');
  const [executionResult, setExecutionResult] = useState<any>(null);
  const [isExecutingCode, setIsExecutingCode] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCreatingSession, setIsCreatingSession] = useState(false);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const [revisionViewerState, setRevisionViewerState] = useState<{
    studentId: string;
    studentName: string;
  } | null>(null);
  
  // Session execution settings
  const [sessionProblemText, setSessionProblemText] = useState<string>('');
  const [sessionExampleInput, setSessionExampleInput] = useState<string>('');
  const [sessionRandomSeed, setSessionRandomSeed] = useState<number | undefined>(undefined);
  const [sessionAttachedFiles, setSessionAttachedFiles] = useState<Array<{ name: string; content: string }>>([]);

  // Construct WebSocket URL
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

  // Handle incoming WebSocket messages
  useEffect(() => {
    if (!lastMessage) return;

    console.log('[WebSocket] Received message:', lastMessage.type, lastMessage.payload);

    switch (lastMessage.type) {
      case 'SESSION_CREATED':
        console.log('[SESSION_CREATED] Setting session state');
        setSessionId(lastMessage.payload.sessionId);
        setJoinCode(lastMessage.payload.joinCode);
        setSessionContext({
          sectionId: lastMessage.payload.sectionId,
          sectionName: lastMessage.payload.sectionName,
        });
        // Restore execution settings from session
        setSessionProblemText(lastMessage.payload.problemText || '');
        setSessionExampleInput(lastMessage.payload.exampleInput || '');
        setSessionRandomSeed(lastMessage.payload.randomSeed);
        setSessionAttachedFiles(lastMessage.payload.attachedFiles || []);
        setViewMode('session');
        setIsCreatingSession(false);
        setError(null);
        break;

      case 'SESSION_JOINED':
        setSessionId(lastMessage.payload.sessionId);
        setJoinCode(lastMessage.payload.joinCode);
        setViewMode('session');
        setError(null);
        break;

      case 'SESSION_ENDED':
        if (lastMessage.payload.sessionId === sessionId) {
          handleLeaveSession();
        }
        break;

      case 'STUDENT_LIST_UPDATE':
        console.log('[STUDENT_LIST_UPDATE] Updating students list');
        setStudents(lastMessage.payload.students || []);
        break;

      case 'STUDENT_JOINED':
        setStudents(prev => {
          const exists = prev.find(s => s.id === lastMessage.payload.studentId);
          if (exists) return prev;
          
          return [...prev, {
            id: lastMessage.payload.studentId,
            name: lastMessage.payload.studentName,
            hasCode: false,
          }];
        });
        break;

      case 'STUDENT_LEFT':
        setStudents(prev => 
          prev.filter(s => s.id !== lastMessage.payload.studentId)
        );
        if (selectedStudentId === lastMessage.payload.studentId) {
          setSelectedStudentId(null);
          setSelectedStudentCode('');
        }
        break;

      case 'CODE_UPDATE':
        setStudents(prev => 
          prev.map(s => 
            s.id === lastMessage.payload.studentId 
              ? { 
                  ...s, 
                  hasCode: true,
                  randomSeed: lastMessage.payload.randomSeed !== undefined ? lastMessage.payload.randomSeed : s.randomSeed,
                  attachedFiles: lastMessage.payload.attachedFiles !== undefined ? lastMessage.payload.attachedFiles : s.attachedFiles,
                }
              : s
          )
        );
        
        if (selectedStudentId === lastMessage.payload.studentId) {
          setSelectedStudentCode(lastMessage.payload.code);
        }
        break;

      case 'STUDENT_CODE':
        if (lastMessage.payload.studentId === selectedStudentId) {
          setSelectedStudentCode(lastMessage.payload.code);
          // Update student's execution settings in the students array
          setStudents(prev => 
            prev.map(s => 
              s.id === lastMessage.payload.studentId
                ? { 
                    ...s, 
                    randomSeed: lastMessage.payload.randomSeed,
                    attachedFiles: lastMessage.payload.attachedFiles,
                  }
                : s
            )
          );
        }
        break;

      case 'EXECUTION_RESULT':
        setExecutionResult(lastMessage.payload);
        setIsExecutingCode(false);
        break;

      case 'PROBLEM_UPDATED':
        // Problem update acknowledged
        break;

      case 'ERROR':
        setError(lastMessage.payload.message);
        setIsCreatingSession(false);
        break;
    }
  }, [lastMessage, sessionId, selectedStudentId]);

  // Navigation handlers
  const handleSelectClass = async (classId: string) => {
    try {
      const response = await fetch(`/api/classes/${classId}`);
      if (!response.ok) throw new Error('Failed to load class');
      const data = await response.json();
      
      setClassContext({
        classId,
        className: data.class.name,
      });
      setViewMode('sections');
    } catch (err) {
      console.error('Error loading class:', err);
      setError('Failed to load class');
    }
  };

  const handleBackToClasses = () => {
    setClassContext(null);
    setViewMode('classes');
  };

  const handleCreateSession = (sectionId: string, sectionName: string) => {
    console.log('[handleCreateSession] Called', { sectionId, sectionName, isConnected });
    
    if (!isConnected) {
      console.error('[handleCreateSession] WebSocket not connected');
      alert('Not connected to server. Please wait for connection or refresh the page.');
      return;
    }

    console.log('[handleCreateSession] Setting state and sending message');
    setIsCreatingSession(true);
    setSessionContext({ sectionId, sectionName });
    setViewMode('session'); // Switch to session view to show "Creating session..." message
    sendMessage('CREATE_SESSION', { sectionId });
    console.log('[handleCreateSession] Message sent');
  };

  const handleJoinSession = (sessionId: string) => {
    if (!isConnected) {
      setError('Not connected to server');
      return;
    }

    sendMessage('JOIN_EXISTING_SESSION', { sessionId });
  };

  const handleLeaveSession = () => {
    setSessionId(null);
    setJoinCode(null);
    setStudents([]);
    setSelectedStudentId(null);
    setSelectedStudentCode('');
    setExecutionResult(null);
    setRevisionViewerState(null);
    setViewMode('sections');
  };

  const handleEndSession = () => {
    if (!sessionId) return;
    
    if (confirm('Are you sure you want to end this session? Students will be disconnected.')) {
      sendMessage('END_SESSION', { sessionId });
      handleLeaveSession();
    }
  };

  const handleUpdateProblem = (
    problemText: string, 
    exampleInput?: string,
    randomSeed?: number,
    attachedFiles?: Array<{ name: string; content: string }>
  ) => {
    if (!sessionId) return;
    // Update local state to keep in sync with server
    setSessionProblemText(problemText);
    setSessionExampleInput(exampleInput || '');
    setSessionRandomSeed(randomSeed);
    setSessionAttachedFiles(attachedFiles || []);
    sendMessage('UPDATE_PROBLEM', { sessionId, problemText, exampleInput, randomSeed, attachedFiles });
  };

  const handleSelectStudent = (studentId: string) => {
    setSelectedStudentId(studentId);
    setExecutionResult(null);
    
    sendMessage('REQUEST_STUDENT_CODE', {
      sessionId,
      studentId,
    });
  };

  const handleExecuteStudentCode = (stdin?: string) => {
    if (!selectedStudentId || !sessionId) return;
    
    setIsExecutingCode(true);
    setExecutionResult(null);
    
    sendMessage('EXECUTE_STUDENT_CODE', {
      sessionId,
      studentId: selectedStudentId,
      stdin,
    });
  };

  const handleViewRevisions = (studentId: string, studentName: string) => {
    setRevisionViewerState({
      studentId,
      studentName,
    });
  };

  const handleCloseRevisionViewer = () => {
    setRevisionViewerState(null);
  };

  const handleShowOnPublicView = (studentId: string) => {
    if (!sessionId) return;
    sendMessage('SELECT_SUBMISSION_FOR_PUBLIC', {
      sessionId,
      studentId,
    });
  };

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      console.error('Sign out error:', err);
      setIsSigningOut(false);
    }
  };

  // Render different views based on mode
  const renderContent = () => {
    if (viewMode === 'classes') {
      return <ClassList onSelectClass={handleSelectClass} />;
    }

    if (viewMode === 'sections' && classContext) {
      return (
        <SectionView
          classId={classContext.classId}
          className={classContext.className}
          onBack={handleBackToClasses}
          onCreateSession={handleCreateSession}
          onJoinSession={handleJoinSession}
        />
      );
    }

    if (viewMode === 'session') {
      // Show loading state while creating session
      if (isCreatingSession) {
        return (
          <div className="text-center py-12">
            <div className="inline-flex items-center gap-3 bg-blue-50 border border-blue-200 rounded-lg p-6">
              <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full"></div>
              <div className="text-left">
                <p className="font-semibold text-blue-900">Creating session...</p>
                <p className="text-sm text-blue-700 mt-1">
                  {sessionContext?.sectionName || 'Setting up your session'}
                </p>
              </div>
            </div>
          </div>
        );
      }

      // Only render session content once we have sessionId and joinCode
      if (!sessionId || !joinCode) {
        return (
          <div className="text-center py-12">
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-6 max-w-md mx-auto">
              <p className="font-semibold text-yellow-900">Waiting for session...</p>
              <p className="text-sm text-yellow-700 mt-2">
                If this persists, please refresh the page.
              </p>
            </div>
          </div>
        );
      }

      return (
        <div className="space-y-6">
          <SessionControls
            joinCode={joinCode}
            sessionId={sessionId}
            sectionName={sessionContext?.sectionName}
            onEndSession={handleEndSession}
            onLeaveSession={handleLeaveSession}
          />

          <ProblemInput
            onUpdateProblem={handleUpdateProblem}
            initialProblemText={sessionProblemText}
            initialExampleInput={sessionExampleInput}
            initialRandomSeed={sessionRandomSeed}
            initialAttachedFiles={sessionAttachedFiles}
          />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <StudentList
              students={students}
              onSelectStudent={handleSelectStudent}
              onShowOnPublicView={handleShowOnPublicView}
              onViewHistory={handleViewRevisions}
            />

            {selectedStudentId && (
              <div>
                <div style={{ marginBottom: '1rem' }}>
                  <h3 style={{ margin: '0 0 0.5rem 0' }}>
                    {students.find(s => s.id === selectedStudentId)?.name || 'Student'}'s Code
                  </h3>
                </div>
                <CodeEditor
                  code={selectedStudentCode}
                  onChange={() => {}} // Read-only for instructor
                  onRun={handleExecuteStudentCode}
                  isRunning={isExecutingCode}
                  randomSeed={students.find(s => s.id === selectedStudentId)?.randomSeed}
                  attachedFiles={students.find(s => s.id === selectedStudentId)?.attachedFiles}
                  readOnly
                />
                {executionResult && (
                  <div style={{ marginTop: '1rem' }}>
                    <OutputPanel result={executionResult} />
                  </div>
                )}
              </div>
            )}
          </div>

          {revisionViewerState && (
            <RevisionViewer
              sessionId={sessionId}
              studentId={revisionViewerState.studentId}
              studentName={revisionViewerState.studentName}
              sendMessage={sendMessage}
              lastMessage={lastMessage}
              onClose={handleCloseRevisionViewer}
            />
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <ProtectedRoute requiredRole="instructor">
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
            <div className="flex justify-between items-center">
              <div>
                <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-600 to-indigo-600 bg-clip-text text-transparent">
                  Instructor Dashboard
                </h1>
                {user && (
                  <p className="text-sm text-gray-600 mt-1">
                    Signed in as {user.username}
                  </p>
                )}
              </div>
              
              <div className="flex items-center gap-4">
                {/* Connection status */}
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${
                    isConnected ? 'bg-green-500' : 'bg-red-500'
                  }`}></div>
                  <span className="text-sm text-gray-600">
                    {connectionStatus}
                  </span>
                </div>

                <button
                  onClick={handleSignOut}
                  disabled={isSigningOut}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isSigningOut ? 'Signing out...' : 'Sign Out'}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main content */}
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {connectionError && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <p className="font-semibold">Connection Error</p>
              <p className="text-sm">{connectionError}</p>
            </div>
          )}

          {error && (
            <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">Error</p>
                  <p className="text-sm">{error}</p>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-red-500 hover:text-red-700"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {isCreatingSession && (
            <div className="mb-6 bg-blue-50 border border-blue-200 rounded-lg p-4 text-blue-700">
              <div className="flex items-center gap-3">
                <div className="animate-spin w-5 h-5 border-2 border-blue-600 border-t-transparent rounded-full"></div>
                <span>Creating session...</span>
              </div>
            </div>
          )}

          {renderContent()}
        </div>
      </div>
    </ProtectedRoute>
  );
}

export default InstructorPage;
